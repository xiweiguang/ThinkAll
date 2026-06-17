import React from 'react';
import { Card, Typography, Divider, Tag } from 'antd';
import './AboutPage.css';

const { Title, Paragraph, Text } = Typography;

const AboutPage = () => {
  return (
    <div className="about-page">
      <Card className="about-card">
        <div className="about-header">
          <img src="/logo.png" alt="想集" className="about-logo" />
          <div className="about-brand">
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>想集</Title>
            <Text type="secondary" style={{ fontSize: 16 }}>ThinkAll</Text>
          </div>
        </div>
        <Divider />
        <div className="about-version">
          <Tag color="blue">v0.0.1</Tag>
          <Text type="secondary">想集 ThinkAll · 智能办公平台</Text>
        </div>
        <Divider />
        <div className="about-slogan">
          <Title level={3} style={{ color: '#1890ff' }}>集所想，办所事</Title>
          <Paragraph type="secondary" style={{ fontSize: 15 }}>
            想集·智能OA是一款集数据可视化、智能图表分析、企业通讯于一体的智能办公平台。
            致力于为企业提供一站式数据洞察与协同办公解决方案，让数据驱动决策，让协作更加高效。
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 15 }}>
            智能无边界 · 集所想，办所事
          </Paragraph>
        </div>
        <Divider />
        <div className="about-copyright">
          <Text type="secondary" style={{ fontSize: 12 }}>
            © 2026 想集 ThinkAll · 智能办公平台
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default AboutPage;
