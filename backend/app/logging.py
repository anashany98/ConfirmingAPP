import logging
import json
import sys
from datetime import datetime
from typing import Any, Dict
from pythonjsonlogger import jsonlogger


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """Custom JSON formatter for structured logging."""

    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]) -> None:
        super().add_fields(log_record, record, message_dict)
        
        # Add standard fields
        log_record['timestamp'] = datetime.utcnow().isoformat() + 'Z'
        log_record['level'] = record.levelname
        log_record['logger'] = record.name
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        
        # Add extra fields
        if hasattr(record, 'extra'):
            for key, value in record.extra.items():
                log_record[key] = value


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    """Setup structured JSON logging."""
    
    # Create logger
    logger = logging.getLogger("confirming")
    logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    
    # Remove existing handlers
    logger.handlers = []
    
    # Create JSON formatter
    formatter = CustomJsonFormatter(
        '%(timestamp)s %(level)s %(logger)s %(module)s %(function)s %(line)s %(message)s'
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger


# Default logger instance
logger = setup_logging()


def log_request(request: Any, response_status: int, response_time: float) -> None:
    """Log HTTP requests in structured format."""
    logger.info(
        "HTTP Request",
        extra={
            "method": request.method,
            "path": request.url.path if hasattr(request, 'url') else "unknown",
            "status_code": response_status,
            "response_time_ms": round(response_time * 1000, 2),
            "client_ip": request.client.host if hasattr(request, 'client') else "unknown",
        }
    )


def log_error(error: Exception, context: Dict[str, Any] = None) -> None:
    """Log errors with context."""
    logger.error(
        str(error),
        extra={
            "error_type": type(error).__name__,
            "context": context or {},
        },
        exc_info=True
    )


def log_security_event(event: str, details: Dict[str, Any]) -> None:
    """Log security-related events."""
    logger.warning(
        f"Security Event: {event}",
        extra={
            "event": event,
            "security": True,
            **details
        }
    )