# -*- coding: utf-8 -*-
from config.database import query


def init_table():
    """创建图表分类表（如果不存在）"""
    query("""
        CREATE TABLE IF NOT EXISTS `sys_chart_categories` (
            `id` INT NOT NULL AUTO_INCREMENT COMMENT '分类ID',
            `name` VARCHAR(100) NOT NULL COMMENT '分类名称',
            `parent_id` INT DEFAULT NULL COMMENT '父分类ID',
            `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
            PRIMARY KEY (`id`),
            KEY `idx_parent_id` (`parent_id`),
            CONSTRAINT `fk_category_parent` FOREIGN KEY (`parent_id`) REFERENCES `sys_chart_categories`(`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图表分类表'
    """)


def get_all_categories():
    """获取所有分类，按 sort_order 排序"""
    return query('SELECT * FROM sys_chart_categories ORDER BY sort_order, id')


def get_category_by_id(category_id):
    """根据ID获取分类"""
    rows = query('SELECT * FROM sys_chart_categories WHERE id = %s', (category_id,))
    return rows[0] if rows else None


def create_category(data):
    """创建分类"""
    sql = """INSERT INTO sys_chart_categories (name, parent_id, sort_order)
             VALUES (%s, %s, %s)"""
    return query(sql, (
        data['name'],
        data.get('parent_id'),
        data.get('sort_order', 0)
    ))


def update_category(category_id, data):
    """更新分类"""
    sets = []
    params = []
    for key in ['name', 'parent_id', 'sort_order']:
        if key in data:
            sets.append(f"`{key}` = %s")
            params.append(data[key])
    if not sets:
        return False
    params.append(category_id)
    sql = f"UPDATE sys_chart_categories SET {', '.join(sets)} WHERE id = %s"
    query(sql, tuple(params))
    return True


def delete_category(category_id):
    """删除分类"""
    query('DELETE FROM sys_chart_categories WHERE id = %s', (category_id,))
    return True


def update_sort_order(category_id, sort_order):
    """更新分类排序值"""
    query('UPDATE sys_chart_categories SET sort_order = %s WHERE id = %s', (sort_order, category_id))
    return True
