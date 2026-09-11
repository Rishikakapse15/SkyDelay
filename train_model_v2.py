"""
Flight Delay Prediction Model v2 - now with weather features
Predicts: Delayed / Not Delayed + probability of delay (%)

Data sources:
  - Airlines.csv       : 539,383 flight records (route, schedule, delay label)
  - flight_data.csv    : weather readings for 200 flights across various dates
                         (no shared key with Airlines.csv -> aggregated to
                          per-route average weather and merged in)
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
import joblib
import json
import time

print("=" * 60)
print("FLIGHT DELAY PREDICTION v2 - TRAINING WITH WEATHER")
print("=" * 60)

# ---------------------------------------------------------
# 1. Load flight data
# ---------------------------------------------------------
df = pd.read_csv("Airlines.csv")
df["Route"] = df["AirportFrom"] + "_" + df["AirportTo"]
print(f"\nLoaded flights: {len(df):,} rows")

# ---------------------------------------------------------
# 2. Load + clean weather data, aggregate to per-route averages
# ---------------------------------------------------------
weather = pd.read_csv("flight_data.csv")
weather["DepCode"] = weather["Departure_Airport"].str.replace(" Airport", "", regex=False)
weather["ArrCode"] = weather["Arrival_Airport"].str.replace(" Airport", "", regex=False)
weather["Route"] = weather["DepCode"] + "_" + weather["ArrCode"]

# Clean visibility column (has stray non-numeric characters like '5ō')
weather["Visibility_km"] = pd.to_numeric(
    weather["Visibility_km"].astype(str).str.extract(r"(\d+)")[0], errors="coerce"
)

# Encode turbulence as ordinal
turb_map = {"Low": 1, "Medium": 2, "High": 3}
weather["Turbulence_Ord"] = weather["Turbulence_Level"].map(turb_map)

route_weather = weather.groupby("Route").agg(
    avg_temp_c=("Temperature_Celsius", "mean"),
    avg_wind_knots=("Wind_Speed_knots", "mean"),
    avg_turbulence=("Turbulence_Ord", "mean"),
    avg_visibility_km=("Visibility_km", "mean"),
).reset_index()

print(f"Weather aggregated for {len(route_weather)} unique routes "
      f"(from {weather['Flight_ID'].nunique()} sample flights)")

# ---------------------------------------------------------
# 3. Merge weather onto flights by route
# ---------------------------------------------------------
df = df.merge(route_weather, on="Route", how="left")
df["has_weather_data"] = df["avg_temp_c"].notna().astype(int)
coverage = df["has_weather_data"].mean()
print(f"Weather coverage: {coverage:.1%} of flight rows matched to a route with weather data")

# Impute missing weather with global averages
for col in ["avg_temp_c", "avg_wind_knots", "avg_turbulence", "avg_visibility_km"]:
    df[col] = df[col].fillna(df[col].mean())

# ---------------------------------------------------------
# 4. Feature engineering (schedule + weather)
# ---------------------------------------------------------
df["DepHour"] = (df["Time"] // 60) % 24

def time_bucket(h):
    if 5 <= h < 12:
        return "Morning"
    elif 12 <= h < 17:
        return "Afternoon"
    elif 17 <= h < 21:
        return "Evening"
    else:
        return "Night"

df["TimeOfDay"] = df["DepHour"].apply(time_bucket)

cat_cols = ["Airline", "AirportFrom", "AirportTo", "Route", "TimeOfDay"]
encoders = {}
for col in cat_cols:
    le = LabelEncoder()
    df[col + "_enc"] = le.fit_transform(df[col])
    encoders[col] = le

feature_cols = [
    "Airline_enc", "AirportFrom_enc", "AirportTo_enc", "Route_enc",
    "DayOfWeek", "Time", "DepHour", "TimeOfDay_enc", "Length",
    "avg_temp_c", "avg_wind_knots", "avg_turbulence", "avg_visibility_km",
    "has_weather_data",
]

X = df[feature_cols]
y = df["Delay"]

# ---------------------------------------------------------
# 5. Train/test split
# ---------------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"\nTrain size: {len(X_train):,} | Test size: {len(X_test):,}")

# ---------------------------------------------------------
# 6. Train model
# ---------------------------------------------------------
print("\nTraining HistGradientBoostingClassifier...")
start = time.time()
model = HistGradientBoostingClassifier(
    max_iter=300,
    learning_rate=0.08,
    max_depth=8,
    l2_regularization=1.0,
    random_state=42
)
model.fit(X_train, y_train)
print(f"Training completed in {time.time()-start:.1f}s")

# ---------------------------------------------------------
# 7. Evaluate
# ---------------------------------------------------------
y_pred = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

acc = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred)
rec = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
auc = roc_auc_score(y_test, y_proba)
cm = confusion_matrix(y_test, y_pred)

print("\n" + "=" * 60)
print("EVALUATION RESULTS (v2 with weather)")
print("=" * 60)
print(f"Accuracy:  {acc:.4f}")
print(f"Precision: {prec:.4f}")
print(f"Recall:    {rec:.4f}")
print(f"F1 Score:  {f1:.4f}")
print(f"ROC-AUC:   {auc:.4f}")
print(f"\nConfusion Matrix:\n{cm}")
print(f"\n{classification_report(y_test, y_pred, target_names=['Not Delayed','Delayed'])}")

# ---------------------------------------------------------
# 8. Feature importance
# ---------------------------------------------------------
sample_idx = np.random.RandomState(42).choice(len(X_test), size=min(20000, len(X_test)), replace=False)
perm = permutation_importance(
    model, X_test.iloc[sample_idx], y_test.iloc[sample_idx],
    n_repeats=3, random_state=42, n_jobs=-1
)
importance_df = pd.DataFrame({
    "feature": feature_cols,
    "importance": perm.importances_mean
}).sort_values("importance", ascending=False)
print("\nFeature Importance:")
print(importance_df.to_string(index=False))

# ---------------------------------------------------------
# 9. Save model + encoders + route weather lookup + metadata
# ---------------------------------------------------------
joblib.dump(model, "flight_delay_model_v2.joblib")
joblib.dump(encoders, "encoders_v2.joblib")
route_weather.to_csv("route_weather_lookup.csv", index=False)

global_weather_avg = {
    col: float(df[col].mean())
    for col in ["avg_temp_c", "avg_wind_knots", "avg_turbulence", "avg_visibility_km"]
}

metadata = {
    "feature_cols": feature_cols,
    "cat_cols": cat_cols,
    "metrics": {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "roc_auc": round(auc, 4)
    },
    "weather_route_coverage_pct": round(coverage * 100, 2),
    "global_weather_avg": global_weather_avg,
    "feature_importance": importance_df.to_dict(orient="records"),
    "n_train": len(X_train),
    "n_test": len(X_test),
}
with open("model_metadata_v2.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("\nSaved: flight_delay_model_v2.joblib, encoders_v2.joblib, "
      "route_weather_lookup.csv, model_metadata_v2.json")
print("\nDONE.")
