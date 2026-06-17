import React from 'react';
import { Input, Select, Row, Col, Button, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

/**
 * 表头分组编辑器组件
 * 用于在图表设计器中编辑多级嵌套表头分组
 */
const HeaderGroupEditor = ({ groups, onChange, visibleFields }) => {
  const updateGroup = (index, updated) => {
    const newGroups = [...groups];
    newGroups[index] = updated;
    onChange(newGroups);
  };

  const removeGroup = (index) => {
    onChange(groups.filter((_, i) => i !== index));
  };

  const getAvailableOptions = (currentGroupIndex) => {
    const usedFields = new Set();
    const usedGroupRefs = new Set();
    groups.forEach((g, i) => {
      if (i !== currentGroupIndex) {
        (g.fields || []).forEach(f => {
          if (f.startsWith('__group__:')) {
            usedGroupRefs.add(f.replace('__group__:', ''));
          } else {
            usedFields.add(f);
          }
        });
      }
    });
    const currentGroup = groups[currentGroupIndex];
    const currentGroupName = currentGroup?.name;
    const groupsReferencingCurrent = new Set();
    if (currentGroupName) {
      const findReferencingGroups = (groupName, visited = new Set()) => {
        groups.forEach((g) => {
          if (visited.has(g.name) || !g.name) return;
          if ((g.fields || []).some(f => f === `__group__:${groupName}`)) {
            groupsReferencingCurrent.add(g.name);
            visited.add(g.name);
            findReferencingGroups(g.name, visited);
          }
        });
      };
      findReferencingGroups(currentGroupName);
    }
    const availableFields = visibleFields
      .filter(f => !usedFields.has(f.name))
      .map(f => ({ label: f.label || f.name, value: f.name }));
    const availableGroups = groups
      .filter((g, i) => i !== currentGroupIndex && g.name && !usedGroupRefs.has(g.name) && !groupsReferencingCurrent.has(g.name))
      .map(g => ({ label: `分组: ${g.name}`, value: `__group__:${g.name}` }));
    const options = [];
    if (availableFields.length > 0) {
      options.push({
        label: '原始字段',
        options: availableFields,
      });
    }
    if (availableGroups.length > 0) {
      options.push({
        label: '已创建分组',
        options: availableGroups,
      });
    }
    return options;
  };

  const resolveFieldIndices = (fields) => {
    const indices = [];
    const visited = new Set();
    const resolve = (fieldList) => {
      fieldList.forEach(f => {
        if (f.startsWith('__group__:')) {
          const refName = f.replace('__group__:', '');
          if (visited.has(refName)) return;
          visited.add(refName);
          const refGroup = groups.find(g => g.name === refName);
          if (refGroup) {
            resolve(refGroup.fields || []);
          }
        } else {
          const idx = visibleFields.findIndex(vf => vf.name === f);
          if (idx >= 0) indices.push(idx);
        }
      });
    };
    resolve(fields);
    return indices.sort((a, b) => a - b);
  };

  return (
    <div>
      {groups.map((group, gIdx) => (
        <div key={gIdx}>
          <Row gutter={8} align="middle" style={{ marginBottom: 8 }}>
            <Col span={5}>
              <Input
                value={group.name}
                onChange={(e) => updateGroup(gIdx, { ...group, name: e.target.value })}
                placeholder="分组名称"
                size="small"
              />
            </Col>
            <Col span={14}>
              <Select
                mode="multiple"
                value={group.fields || []}
                onChange={(val) => {
                  if (val.length > 1) {
                    const indices = resolveFieldIndices(val);
                    const isAdjacent = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
                    if (!isAdjacent) {
                      message.warning('只能合并相邻的列，请重新选择');
                      return;
                    }
                  }
                  updateGroup(gIdx, { ...group, fields: val });
                }}
                placeholder="选择包含的字段或分组（仅相邻项）"
                size="small"
                style={{ width: '100%' }}
                options={getAvailableOptions(gIdx)}
              />
            </Col>
            <Col span={5}>
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeGroup(gIdx)}
              />
            </Col>
          </Row>
        </div>
      ))}
    </div>
  );
};

export default HeaderGroupEditor;
