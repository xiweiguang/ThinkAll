import {
  TableOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  FileTextOutlined,
  TeamOutlined,
  HomeOutlined,
  ScheduleOutlined,
  AuditOutlined,
  PieChartOutlined,
  EnvironmentOutlined,
  LineChartOutlined,
  DotChartOutlined,
  RadarChartOutlined,
  AreaChartOutlined,
} from '@ant-design/icons';

const iconMap = {
  TableOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  FileTextOutlined,
  TeamOutlined,
  HomeOutlined,
  ScheduleOutlined,
  AuditOutlined,
  PieChartOutlined,
  EnvironmentOutlined,
  LineChartOutlined,
  DotChartOutlined,
  RadarChartOutlined,
  AreaChartOutlined,
};

const tables = [];

export function getTableIcon(iconName) {
  return iconMap[iconName] || TableOutlined;
}

export default tables;
