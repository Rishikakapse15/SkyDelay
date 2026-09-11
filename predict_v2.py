"""
Flight Delay Predictor - Inference Script (v2, with weather)
Loads the trained model and predicts Delayed/Not Delayed + probability %.

Usage (edit the flight details below, or import predict_delay() elsewhere):
    python predict_v2.py
"""

import joblib
import pandas as pd

# ---------------------------------------------------------
# Load trained artifacts
# ---------------------------------------------------------
model = joblib.load("flight_delay_model_v2.joblib")
encoders = joblib.load("encoders_v2.joblib")
route_weather = pd.read_csv("route_weather_lookup.csv").set_index("Route")

# Global fallback averages used when a route has no weather data
GLOBAL_WEATHER_AVG = {
    "avg_temp_c": route_weather["avg_temp_c"].mean(),
    "avg_wind_knots": route_weather["avg_wind_knots"].mean(),
    "avg_turbulence": route_weather["avg_turbulence"].mean(),
    "avg_visibility_km": route_weather["avg_visibility_km"].mean(),
}


def time_bucket(h):
    if 5 <= h < 12:
        return "Morning"
    elif 12 <= h < 17:
        return "Afternoon"
    elif 17 <= h < 21:
        return "Evening"
    else:
        return "Night"


def safe_encode(encoder, value, col_name):
    """Encode a category, falling back gracefully if unseen during training."""
    if value in encoder.classes_:
        return encoder.transform([value])[0]
    else:
        print(f"Warning: '{value}' was not seen during training for {col_name}. "
              f"Using fallback class.")
        return 0


def get_route_weather(route):
    if route in route_weather.index:
        row = route_weather.loc[route]
        return {
            "avg_temp_c": row["avg_temp_c"],
            "avg_wind_knots": row["avg_wind_knots"],
            "avg_turbulence": row["avg_turbulence"],
            "avg_visibility_km": row["avg_visibility_km"],
        }, 1
    else:
        return GLOBAL_WEATHER_AVG, 0


def predict_delay(airline, airport_from, airport_to, day_of_week, sched_time_minutes, length_minutes):
    """
    airline: airline code, e.g. 'AA'
    airport_from / airport_to: IATA airport codes, e.g. 'JFK', 'LAX'
    day_of_week: int, 1=Monday ... 7=Sunday (matches dataset encoding)
    sched_time_minutes: scheduled departure time in minutes from midnight (e.g. 14:30 -> 870)
    length_minutes: scheduled flight duration in minutes
    """
    dep_hour = (sched_time_minutes // 60) % 24
    tod = time_bucket(dep_hour)
    route = f"{airport_from}_{airport_to}"
    weather_vals, has_weather = get_route_weather(route)

    row = {
        "Airline_enc": safe_encode(encoders["Airline"], airline, "Airline"),
        "AirportFrom_enc": safe_encode(encoders["AirportFrom"], airport_from, "AirportFrom"),
        "AirportTo_enc": safe_encode(encoders["AirportTo"], airport_to, "AirportTo"),
        "Route_enc": safe_encode(encoders["Route"], route, "Route"),
        "DayOfWeek": day_of_week,
        "Time": sched_time_minutes,
        "DepHour": dep_hour,
        "TimeOfDay_enc": safe_encode(encoders["TimeOfDay"], tod, "TimeOfDay"),
        "Length": length_minutes,
        "avg_temp_c": weather_vals["avg_temp_c"],
        "avg_wind_knots": weather_vals["avg_wind_knots"],
        "avg_turbulence": weather_vals["avg_turbulence"],
        "avg_visibility_km": weather_vals["avg_visibility_km"],
        "has_weather_data": has_weather,
    }

    X = pd.DataFrame([row])
    pred = model.predict(X)[0]
    proba_delay = model.predict_proba(X)[0][1]

    return {
        "prediction": "Delayed" if pred == 1 else "Not Delayed",
        "delay_probability_pct": round(float(proba_delay) * 100, 1),
        "used_real_weather_for_route": bool(has_weather)
    }


if __name__ == "__main__":
    # Example: an AA flight from SFO to DFW, Wednesday, departing at 8:00 PM (1200 min), 195 min flight
    result = predict_delay(
        airline="AA",
        airport_from="SFO",
        airport_to="DFW",
        day_of_week=3,
        sched_time_minutes=1200,
        length_minutes=195
    )
    print(result)
