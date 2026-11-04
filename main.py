"""
Бэкенд-сервис на Python (FastAPI) с поддержкой WebSockets для работы с рыночными данными Bybit API V5.
- Эндпоинты истории свечей (/api/candles, /api/data) с исторической пагинацией назад через параметр end.
- WebSocket эндпоинт (/ws/candles) для трансляции котировок и тиков свечей в реальном времени.
"""

from typing import Optional, List, Dict, Any
import asyncio
import json
import os
import time
import urllib.parse
import urllib.request

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

# Библиотека websockets для асинхронного клиентского подключения к WebSocket Bybit
try:
    import websockets
except ImportError:
    websockets = None

app = FastAPI(
    title="TradingView & Bybit Market Data Real-time API",
    description="API для истории свечей Bybit V5 и трансляции тиков свечей в реальном времени через WebSocket.",
    version="2.0.0"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Сопоставление строковых таймфреймов в нотацию Bybit V5
# Допустимые интервалы Bybit: 1, 3, 5, 15, 30, 60, 120, 240, 360, 720, D, M, W
TIMEFRAME_MAP = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1D": "D",
    "D": "D",
    "1W": "W",
    "W": "W",
    "1M": "M",
    "M": "M"
}


def fetch_bybit_klines(
    symbol: str = "BTCUSDT",
    timeframe: str = "1m",
    end_timestamp: Optional[int] = None,
    limit: int = 200,
    category: str = "spot"
) -> List[Dict[str, Any]]:
    """
    Получение исторических свечей через REST API Bybit V5 (/v5/market/kline).
    Свечи возвращаются отсортированными по возрастанию времени (от старых к новым).
    """
    clean_symbol = symbol.replace("/", "").replace("-", "").upper()
    bybit_interval = TIMEFRAME_MAP.get(timeframe, timeframe)

    params: Dict[str, Any] = {
        "category": category,
        "symbol": clean_symbol,
        "interval": bybit_interval,
        "limit": min(max(1, limit), 1000)
    }

    # Если передан timestamp в секундах, переводим в миллисекунды для Bybit
    if end_timestamp is not None and end_timestamp > 0:
        params["end"] = int(end_timestamp * 1000)

    url = f"https://api.bybit.com/v5/market/kline?{urllib.parse.urlencode(params)}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; TradingPlatform/2.0)",
                "Accept": "application/json"
            }
        )

        with urllib.request.urlopen(req, timeout=7) as response:
            if response.status != 200:
                raise HTTPException(status_code=response.status, detail=f"Ошибка Bybit HTTP: {response.status}")
            data = json.loads(response.read().decode("utf-8"))

        if data.get("retCode") != 0:
            # Если пара отсутствует на споте, пробуем деривативы (linear)
            if category == "spot":
                return fetch_bybit_klines(symbol, timeframe, end_timestamp, limit, category="linear")
            raise HTTPException(status_code=400, detail=data.get("retMsg", "Ошибка API Bybit"))

        raw_list = data.get("result", {}).get("list", [])
        if not raw_list:
            return []

        candles: List[Dict[str, Any]] = []
        for item in raw_list:
            try:
                # [startTime(ms), open, high, low, close, volume, turnover]
                candles.append({
                    "time": int(item[0]) // 1000,
                    "open": float(item[1]),
                    "high": float(item[2]),
                    "low": float(item[3]),
                    "close": float(item[4]),
                    "volume": float(item[5])
                })
            except (ValueError, IndexError):
                continue

        # Bybit отдает от новых к старым — разворачиваем хронологически (от старых к новым)
        candles.sort(key=lambda c: c["time"])
        return candles

    except Exception as err:
        if isinstance(err, HTTPException):
            raise err
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки данных Bybit: {str(err)}")


# --- REST API ЭНДПОИНТЫ ---

@app.get("/api/candles")
@app.get("/api/data")
def get_candles(
    symbol: str = Query(default="BTCUSDT", description="Символ пары, например BTCUSDT"),
    timeframe: str = Query(default="1m", description="Интервал (1m, 5m, 15m, 1h, 4h, 1D)"),
    end: Optional[int] = Query(default=None, description="UNIX timestamp (сек) для пагинации назад"),
    limit: int = Query(default=200, ge=1, le=1000, description="Количество свечей (до 1000)"),
    category: str = Query(default="spot", description="Категория рынка: spot или linear")
):
    """Возвращает историю свечей с поддержкой подгрузки прошлого через параметр end."""
    candles = fetch_bybit_klines(
        symbol=symbol,
        timeframe=timeframe,
        end_timestamp=end,
        limit=limit,
        category=category
    )
    return {
        "success": True,
        "symbol": symbol.replace("/", "").upper(),
        "timeframe": timeframe,
        "count": len(candles),
        "firstTime": candles[0]["time"] if candles else None,
        "lastTime": candles[-1]["time"] if candles else None,
        "candles": candles
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": int(time.time()),
        "service": "Bybit V5 Realtime Provider",
        "websockets_installed": websockets is not None
    }


# Автоматическая отдача index.html при открытии в браузере
@app.get("/")
def serve_index():
    for path in ["index.html", "standalone_index.html", "public/standalone_index.html"]:
        if os.path.exists(path):
            return FileResponse(path)
    return JSONResponse({
        "message": "Bybit V5 Real-time WebSocket Server running.",
        "websocket_url": "ws://localhost:8000/ws/candles?symbol=BTCUSDT&timeframe=1m",
        "rest_api_url": "http://localhost:8000/api/candles?symbol=BTCUSDT&timeframe=1m"
    })


# --- WEBSOCKET ЭНДПОИНТ ДЛЯ РЕАЛЬНОГО ВРЕМЕНИ ---

@app.websocket("/ws/candles")
async def websocket_candles(
    websocket: WebSocket,
    symbol: str = Query(default="BTCUSDT"),
    timeframe: str = Query(default="1m"),
    category: str = Query(default="spot")
):
    """
    WebSocket эндпоинт реального времени.
    1. Принимает подключение от браузера.
    2. Асинхронно подключается к публичному WebSocket Bybit V5 (wss://stream.bybit.com/v5/public/spot).
    3. Подписывается на kline.<interval>.<symbol>.
    4. Каждые 20 секунд шлет Bybit keepalive ping.
    5. Полученные тики свечей мгновенно ретранслирует клиенту.
    """
    await websocket.accept()

    if websockets is None:
        await websocket.send_json({
            "error": "Пакет 'websockets' не установлен на сервере. Установите: pip install websockets"
        })
        await websocket.close()
        return

    clean_symbol = symbol.replace("/", "").replace("-", "").upper()
    bybit_interval = TIMEFRAME_MAP.get(timeframe, timeframe)

    # Выбор WebSocket URL Bybit в зависимости от рынка
    bybit_ws_url = (
        "wss://stream.bybit.com/v5/public/spot"
        if category.lower() == "spot"
        else "wss://stream.bybit.com/v5/public/linear"
    )

    kline_topic = f"kline.{bybit_interval}.{clean_symbol}"
    stop_event = asyncio.Event()

    async def keep_alive(bybit_ws):
        """Отправляет Bybit регулярный ping каждые 20 секунд, чтобы соединение не разрывалось."""
        try:
            while not stop_event.is_set():
                await asyncio.sleep(20)
                if bybit_ws.open:
                    await bybit_ws.send(json.dumps({"op": "ping"}))
        except (asyncio.CancelledError, Exception):
            pass

    async def listen_client():
        """Слушает сообщения от клиента (например, смена пары или ping)."""
        try:
            while not stop_event.is_set():
                data = await websocket.receive_text()
                try:
                    msg = json.loads(data)
                    # Если клиент шлет пинг, отвечаем понг
                    if msg.get("op") == "ping" or msg.get("action") == "ping":
                        await websocket.send_json({"op": "pong", "time": int(time.time())})
                except json.JSONDecodeError:
                    pass
        except (WebSocketDisconnect, asyncio.CancelledError, Exception):
            stop_event.set()

    try:
        # Подключаемся к публичному стриму Bybit V5
        async with websockets.connect(
            bybit_ws_url,
            ping_interval=None,  # Управляем ping вручную через keep_alive
            close_timeout=5
        ) as bybit_ws:

            # Подписываемся на канал kline
            subscribe_msg = {
                "op": "subscribe",
                "args": [kline_topic]
            }
            await bybit_ws.send(json.dumps(subscribe_msg))

            # Запускаем фоновые задачи
            ping_task = asyncio.create_task(keep_alive(bybit_ws))
            client_task = asyncio.create_task(listen_client())

            try:
                while not stop_event.is_set():
                    # Получаем сообщение от Bybit
                    try:
                        message = await asyncio.wait_for(bybit_ws.recv(), timeout=25.0)
                    except asyncio.TimeoutError:
                        # Повторный ping при таймауте
                        if bybit_ws.open:
                            await bybit_ws.send(json.dumps({"op": "ping"}))
                        continue

                    parsed = json.loads(message)

                    # Проверяем, содержит ли сообщение данные свечи kline
                    topic = parsed.get("topic", "")
                    if topic.startswith("kline") and "data" in parsed:
                        kline_list = parsed["data"]
                        if isinstance(kline_list, list) and len(kline_list) > 0:
                            k = kline_list[0]
                            # Преобразуем формат Bybit в удобный формат для TradingView Lightweight Charts
                            formatted_candle = {
                                "time": int(k["start"]) // 1000,
                                "open": float(k["open"]),
                                "high": float(k["high"]),
                                "low": float(k["low"]),
                                "close": float(k["close"]),
                                "volume": float(k["volume"]),
                                "confirm": bool(k.get("confirm", False)),
                                "symbol": clean_symbol,
                                "timeframe": timeframe
                            }
                            # Мгновенно отправляем свечу клиенту через WebSocket
                            await websocket.send_json(formatted_candle)

            finally:
                stop_event.set()
                ping_task.cancel()
                client_task.cancel()

    except WebSocketDisconnect:
        # Штатное отключение браузера (закрытие вкладки или смена пары)
        pass
    except Exception as err:
        # Попытка уведомить клиент об ошибке перед закрытием
        try:
            await websocket.send_json({"error": f"Ошибка соединения с Bybit: {str(err)}"})
        except Exception:
            pass
    finally:
        stop_event.set()


if __name__ == "__main__":
    import uvicorn
    print("\n" + "=" * 60)
    print("  🚀 Запуск сервера котировок Bybit V5 Real-Time")
    print("  • REST API:      http://localhost:8000/api/candles")
    print("  • WebSocket:     ws://localhost:8000/ws/candles")
    print("  • Веб-интерфейс: http://localhost:8000/")
    print("=" * 60 + "\n")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
