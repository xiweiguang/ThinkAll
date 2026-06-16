import os
import re
from datetime import datetime
from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from utils.response import success, error
from utils.logger import LOG_DIR

log_bp = Blueprint('log_viewer', __name__, url_prefix='/api/logs')


@log_bp.route('/errors', methods=['GET'])
@login_required
@permission_required('system:log:read')
def get_error_logs():
    """获取ERROR和CRITICAL级别日志"""
    date_str = request.args.get('date', '')
    limit = int(request.args.get('limit', 200))

    # 限制limit最大值，防止恶意请求消耗资源
    if limit > 1000:
        limit = 1000

    today_str = datetime.now().strftime('%Y-%m-%d')

    if date_str:
        # 校验日期格式必须为YYYY-MM-DD，防止路径遍历攻击
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            return error('日期格式不正确，应为YYYY-MM-DD', 400)
        # 当天日志在 app.log 中，历史日志在 {日期}.log 中
        if date_str == today_str:
            log_file = os.path.join(LOG_DIR, 'app.log')
        else:
            log_file = os.path.join(LOG_DIR, f"{date_str}.log")
    else:
        # 未指定日期时，读取当天日志（app.log）
        log_file = os.path.join(LOG_DIR, 'app.log')

    if not os.path.exists(log_file):
        return success([])

    error_logs = []
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            for line in f:
                if '[ERROR]' in line or '[CRITICAL]' in line:
                    error_logs.append(line.strip())
                    if len(error_logs) >= limit:
                        break
    except Exception as e:
        return error(f'读取日志文件失败: {str(e)}', 500)

    return success(error_logs)


@log_bp.route('/dates', methods=['GET'])
@login_required
@permission_required('system:log:read')
def get_log_dates():
    """获取有日志文件的日期列表"""
    if not os.path.exists(LOG_DIR):
        return success([])

    dates = []
    today_str = datetime.now().strftime('%Y-%m-%d')
    today_added = False
    for filename in sorted(os.listdir(LOG_DIR), reverse=True):
        if filename == 'app.log':
            # 当天日志文件，添加今天日期
            if not today_added:
                dates.append(today_str)
                today_added = True
        elif filename.endswith('.log'):
            date_part = filename.replace('.log', '')
            # 跳过与今天日期重复的历史日志文件
            if date_part == today_str:
                continue
            dates.append(date_part)

    return success(dates[:30])
