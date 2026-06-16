# -*- coding: utf-8 -*-
from flask import Blueprint, request
from middleware.auth import login_required
from middleware.permission import permission_required
from models.chart_category import get_all_categories, get_category_by_id, create_category, update_category, delete_category
from utils.response import success, error

chart_category_bp = Blueprint('chart_category', __name__, url_prefix='/api/chart-categories')


def build_category_tree(categories):
    """将扁平分类列表转换为树形结构"""
    category_map = {}
    for cat in categories:
        cat_id = cat['id']
        category_map[cat_id] = {
            'id': cat_id,
            'name': cat['name'],
            'parentId': cat.get('parent_id'),
            'sortOrder': cat.get('sort_order', 0),
            'createdAt': cat.get('created_at'),
            'updatedAt': cat.get('updated_at'),
            'children': []
        }

    tree = []
    for cat in categories:
        cat_id = cat['id']
        parent_id = cat.get('parent_id')
        node = category_map[cat_id]
        if parent_id and parent_id in category_map:
            category_map[parent_id]['children'].append(node)
        else:
            tree.append(node)

    return tree


@chart_category_bp.route('', methods=['GET'])
@login_required
def list_categories():
    """获取所有分类（返回树形结构）"""
    categories = get_all_categories()
    tree = build_category_tree(categories)
    return success(tree)


@chart_category_bp.route('', methods=['POST'])
@login_required
@permission_required('chart:category:create')
def create_category_route():
    """创建分类"""
    data = request.get_json() or {}
    if not data.get('name'):
        return error('分类名称不能为空', 400)
    create_category(data)
    return success(None, '分类创建成功')


@chart_category_bp.route('/<int:category_id>', methods=['PUT'])
@login_required
@permission_required('chart:category:update')
def update_category_route(category_id):
    """更新分类"""
    existing = get_category_by_id(category_id)
    if not existing:
        return error('分类不存在', 404)
    data = request.get_json() or {}
    update_category(category_id, data)
    return success(None, '分类更新成功')


@chart_category_bp.route('/<int:category_id>', methods=['DELETE'])
@login_required
@permission_required('chart:category:delete')
def delete_category_route(category_id):
    """删除分类"""
    existing = get_category_by_id(category_id)
    if not existing:
        return error('分类不存在', 404)
    delete_category(category_id)
    return success(None, '分类删除成功')
