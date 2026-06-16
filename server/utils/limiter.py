# -*- coding: utf-8 -*-
import os
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

_storage_uri = os.getenv('REDIS_URL', '')
if _storage_uri:
    _storage_options = {}
else:
    _storage_uri = 'memory://'
    _storage_options = {}

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_storage_uri,
    storage_options=_storage_options,
)
