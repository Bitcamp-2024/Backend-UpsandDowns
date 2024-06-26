import yfinance as yf
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import sys
from textblob import TextBlob
from sklearn.model_selection import train_test_split
import json


def get_sentiment(ticker):
    name = ticker.info.get('symbol').lower()
    long_name = ticker.info.get('longName').lower().split()[0]

    news = ticker.news

    sum = 0
    num_news = 1
    for article in news:
        title = article.get("title").lower()
        if (name in title) or (long_name in title):
            sum += TextBlob(title).sentiment.polarity
            num_news += 1

    return sum/num_news


def get_info(ticker):
    info = ticker.info

    data = {"forwardEps": info.get('forwardEps'), 
            "marketCap": info.get('marketCap'), 
            "trailingPE": info.get('trailingPE'), 
            "yfRecommendation": info.get('recommendationKey')}
    return data


def get_recommendation(ticker, mCap, sentiment):
    data = pd.read_csv('data.csv', index_col=0)

    X = data[['epsGrowth', 'marketCap', 'sentiment']]
    # y: target variable (recommendation)
    y = data['recommendation']

    # Splitting the data into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Creating the random forest classifier
    rf_classifier = RandomForestClassifier(n_estimators=100, random_state=42)

    # Training the classifier
    rf_classifier.fit(X_train, y_train)

    eps_growth = (ticker.info.get('forwardEps') - ticker.info.get('trailingEps'))/ticker.info.get('trailingEps')
    new_row = pd.DataFrame({'epsGrowth': eps_growth, 'marketCap': mCap, 'sentiment': sentiment}, index=[501])
    
    return rf_classifier.predict(new_row)[0]



arguements = sys.argv
name = arguements[1]

ticker = yf.Ticker(name)
df = ticker.history(period="14y")

df.index = pd.to_datetime(df.index)

df['SMA20'] = df['Close'].rolling(window=20).mean()
df['SMA50'] = df['Close'].rolling(window=50).mean()

df['EMA12'] = df['Close'].ewm(span=12, adjust=False).mean()
df['EMA26'] = df['Close'].ewm(span=26, adjust=False).mean()

df['MACD'] = df['EMA12'] - df['EMA26']
df['Signal_Line'] = df['MACD'].ewm(span=9, adjust=False).mean()



def plot():
  fig = make_subplots(vertical_spacing = 0, rows=2, cols=1, row_heights=[0.8, 0.2])

  fig.add_trace(go.Candlestick(x=df.index,
                  open=df['Open'],
                  high=df['High'],
                  low=df['Low'],
                  close=df['Close'],name=ticker),
                row=1,col=1)

  fig.add_trace(go.Scatter(
      x=df.index,
      y=df['SMA20'],
      mode='lines',
      name='SMA20',
      line=dict(color='royalblue',width=2)))

  fig.add_trace(go.Scatter(
      x=df.index,
      y=df['SMA50'],
      mode='lines',
      name='SMA50',
      line=dict(color='green',width=2)))
  
  fig.add_trace(go.Bar(
    x=df.index,
    y=df['Volume']/10000000,
    name='Volume'), row=1, col=1)
  
  fig.add_trace(go.Bar(
      x=df.index,
      y=df['MACD'],
      name='MACD'),row=2, col=1)
  
  fig.add_trace(go.Scatter(
      x=df.index,
      y=df['Signal_Line'],
      mode='lines',
      name='MACD: Signal Line',
      line=dict(color='orange',width=1)), row=2, col=1)


  fig.update_layout(xaxis_rangeslider_visible=False,
                    xaxis=dict(zerolinecolor='black', showticklabels=False),
                    xaxis2=dict(showticklabels=False))

  fig.update_xaxes(showline=True, linewidth=1, linecolor='black', mirror=False)



  # fig.show()

  # fig.write_html("index.html")
  # fig.write_image("figCopy.png")

# plot()

del df["Dividends"]
del df["Stock Splits"]

df["Tomorrow"] = df["Close"].shift(-1)

df["Target"] = (df["Tomorrow"] > df["Close"]).astype(int)

df = df.loc["2005-01-01":].copy()

from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier(n_estimators=5, min_samples_split=100, random_state=1)

train = df.iloc[:-100]
test = df.iloc[-100:]

predictors = ["Close", "Volume", "Open", "High", "Low"]
model.fit(train[predictors], train["Target"])

from sklearn.metrics import precision_score

preds = model.predict(test[predictors])
preds = pd.Series(preds, index=test.index)
precision_score(test["Target"], preds)

combined = pd.concat([test["Target"], preds], axis=1)

def predict(train, test, predictors, model):
    model.fit(train[predictors], train["Target"])
    preds = model.predict(test[predictors])
    preds = pd.Series(preds, index=test.index, name="Predictions")
    combined = pd.concat([test["Target"], preds], axis=1)
    return combined

def backtest(data, model, predictors, start=2000, step=250):
    all_predictions = []
    if int(data.shape[0] * .1) == 0:
      return -1
    for i in range(start, data.shape[0], step):
        train = data.iloc[0:i].copy()
        test = data.iloc[i:(i+step)].copy()
        predictions = predict(train, test, predictors, model)
        all_predictions.append(predictions)
    
    print(all_predictions)
    print(data.shape[0])
    return pd.concat(all_predictions)

horizons = [5,8,20,250,1000]
new_predictors = []

for horizon in horizons:
    rolling_averages = df.rolling(horizon).mean()
    
    ratio_column = f"Close_Ratio_{horizon}"
    df[ratio_column] = df["Close"] / rolling_averages["Close"]
    
    trend_column = f"Trend_{horizon}"
    df[trend_column] = df.shift(1).rolling(horizon).sum()["Target"]
    
    new_predictors+= [ratio_column, trend_column]

df = df.dropna(subset=df.columns[df.columns != "Tomorrow"])

model = RandomForestClassifier(n_estimators=50, min_samples_split=50, random_state=1)

def predict(train, test, predictors, model):
    model.fit(train[predictors], train["Target"])
    preds = model.predict_proba(test[predictors])[:,1]
    preds[preds >=.53] = 1
    preds[preds <.53] = 0
    preds = pd.Series(preds, index=test.index, name="Predictions")
    combined = pd.concat([test["Target"], preds], axis=1)
    return combined

predictions = backtest(df, model, new_predictors)

if not isinstance(predictions, pd.DataFrame) and predictions == -1:
   output = {"recommendation": "Erm...idk"}
   print(json.dumps(output))
   sys.stdout.flush()
   exit()

predictions["Predictions"].value_counts()

if predictions["Predictions"].value_counts()[1] - predictions["Predictions"].value_counts()[0] > 40:
  result = ("UP UP UP!")
elif predictions["Predictions"].value_counts()[1] - predictions["Predictions"].value_counts()[0] < -40:
  result = ("Going down!")
else:
  result = ("Sideways")


df_indicators = df[["Close", "Volume", "Open", "High", "Low", "SMA20", "SMA50", "MACD", "Signal_Line"]]
df_indicators.index = df.index.strftime("%Y-%m-%d")
df_indicators = df_indicators.to_dict()

sentiment = get_sentiment(ticker)

if sentiment == 0:
  sentiment = 0
elif sentiment > 0.1:
  sentiment = 1
else:
   sentiment = -1

stats = get_info(ticker)

recc = get_recommendation(ticker, stats.get("marketCap"), sentiment)
link = f"https://logo.clearbit.com/{ticker.info.get('website')}"
output = {"Prediction": result, "sentiment": sentiment, "stats": stats, "recommendation": recc, "logo_link": link, "df_indicators": df_indicators}

print(json.dumps(output))
sys.stdout.flush()