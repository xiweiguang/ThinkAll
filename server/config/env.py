import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    APP_NAME = os.getenv('APP_NAME', '数据可视化')
    APP_PORT = int(os.getenv('APP_PORT', 3001))
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', 3306))
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'root')
    DB_NAME = os.getenv('DB_NAME', 'data_vis')
    JWT_SECRET = os.getenv('JWT_SECRET')
    if not JWT_SECRET:
        JWT_SECRET = 'data_vis_secret_key_2024'
        import warnings
        warnings.warn('JWT_SECRET 未设置，使用默认值。生产环境请务必配置 JWT_SECRET 环境变量！', RuntimeWarning)
    JWT_EXPIRES_IN = os.getenv('JWT_EXPIRES_IN', '24h')
    DATASOURCE_ENCRYPT_KEY = os.getenv('DATASOURCE_ENCRYPT_KEY')
    if not DATASOURCE_ENCRYPT_KEY:
        DATASOURCE_ENCRYPT_KEY = 'data_vis_datasource_encrypt_key_2024'
        import warnings
        warnings.warn('DATASOURCE_ENCRYPT_KEY 未设置，使用默认值。生产环境请务必配置 DATASOURCE_ENCRYPT_KEY 环境变量！', RuntimeWarning)


config = Config()
