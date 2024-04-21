import yfinance as yf
from textblob import TextBlob


def get_sentiment(name):
    name = name.lower()
    ticker = yf.Ticker(name)

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


def get_info(name):
    ticker = yf.Ticker(name)
    info = ticker.info

    data = {"forwardEps": info.get('forwardEps'), 
            "marketCap": info.get('marketCap'), 
            "trailingPE": info.get('trailingPE'), 
            "recommendationKey": info.get('recommendationKey')}
    return data

