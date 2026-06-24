import os
import logging
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime, date

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(LOG_DIR, exist_ok=True)


def _log_namer(default_name):
    """自定义日志轮转命名：将 app.log.2026-06-09 重命名为 2026-06-09.log"""
    dir_name = os.path.dirname(default_name)
    base = os.path.basename(default_name)
    parts = base.split('.')
    if len(parts) >= 3 and parts[0] == 'app' and parts[1] == 'log':
        date_part = parts[2]
        return os.path.join(dir_name, f'{date_part}.log')
    return default_name


def _rotate_log_on_startup():
    """启动时检查 app.log 是否需要轮转：如果最后修改日期不是今天，则重命名为 {日期}.log"""
    log_file = os.path.join(LOG_DIR, 'app.log')
    if not os.path.exists(log_file):
        return
    mtime = os.path.getmtime(log_file)
    mtime_date = date.fromtimestamp(mtime)
    today = date.today()
    if mtime_date < today:
        dest = os.path.join(LOG_DIR, f'{mtime_date.strftime("%Y-%m-%d")}.log')
        if not os.path.exists(dest):
            os.rename(log_file, dest)


def get_logger(name='app'):
    """获取日志记录器，按日保存日志文件"""
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    # 启动时检查是否需要轮转昨天的日志
    _rotate_log_on_startup()

    # 使用固定文件名，轮转后由 namer 生成 {日期}.log
    log_file = os.path.join(LOG_DIR, 'app.log')

    file_handler = TimedRotatingFileHandler(
        log_file,
        when='midnight',
        interval=1,
        backupCount=90,
        encoding='utf-8',
    )
    file_handler.suffix = '%Y-%m-%d'
    file_handler.namer = _log_namer
    file_handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter(
        '[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger


app_logger = get_logger('app')


# 高频轮询接口路径列表，使用DEBUG级别记录避免控制台刷屏
_HIGH_FREQUENCY_PATHS = [
    '/api/chat/unread',
    '/api/chat/unread-by-sender',
    '/api/health',
]


def log_api_request(method, path, user_id=None, params=None):
    """记录API请求日志，高频轮询接口使用DEBUG级别"""
    user_info = f"用户ID={user_id}" if user_id else "未登录"
    param_info = f" 参数={params}" if params else ""
    log_msg = f"API请求: {method} {path} {user_info}{param_info}"
    if path in _HIGH_FREQUENCY_PATHS:
        app_logger.debug(log_msg)
    else:
        app_logger.info(log_msg)


def log_db_operation(operation, table, detail=None):
    """记录数据库操作日志"""
    detail_info = f" 详情={detail}" if detail else ""
    app_logger.debug(f"数据库操作: {operation} 表={table}{detail_info}")


def log_error(module, error_msg, detail=None):
    """记录错误日志"""
    detail_info = f" 详情={detail}" if detail else ""
    app_logger.error(f"错误: 模块={module} {error_msg}{detail_info}")


def log_warning(module, msg, detail=None):
    """记录警告日志"""
    detail_info = f" 详情={detail}" if detail else ""
    app_logger.warning(f"警告: 模块={module} {msg}{detail_info}")


def log_info(module, msg):
    """记录信息日志"""
    app_logger.info(f"{module}: {msg}")
