import data_processor
import pandas as pd
df = data_processor.fetch_orders_from_snowflake(print)
df['EST_DEPARTURE'] = pd.to_datetime(df['EST_DEPARTURE'])
df['year'] = df['EST_DEPARTURE'].dt.isocalendar().year
df['week'] = df['EST_DEPARTURE'].dt.isocalendar().week

w33 = df[(df['year'] == 2026) & (df['week'] == 33)]
print(f"WK 33-2026 sum: {w33['Total TEU'].sum() if len(w33) else 0}, rows: {len(w33)}")

w34 = df[(df['year'] == 2026) & (df['week'] == 34)]
print(f"WK 34-2026 sum: {w34['Total TEU'].sum() if len(w34) else 0}, rows: {len(w34)}")
