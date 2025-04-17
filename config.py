import os, json
from datetime import datetime


def get_today():
    now = datetime.now()
    return now.strftime('%Y-%m-%d')

try:
    CONFIG = {
        "meta": {
                "title": "G17 Explorer",
                "datestamp": get_today(),
                "author":"Christoph Sander",
                "home":"https://dhi-roma.github.io/g17-explorer/"
                },
        "pages": {}
    }
except Exception as e:
    print("Error loading CONFIG!", e)
    CONFIG = {}