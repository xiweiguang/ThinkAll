import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

/**
 * 获取带日期的文件名
 * @param {string} fileName - 图表名称
 * @param {string} ext - 文件扩展名
 * @returns {string} 格式化的文件名，如 "图表名称_20260501.png"
 */
function getFormattedFileName(fileName, ext) {
  const dateStr = dayjs().format('YYYYMMDD');
  return `${fileName}_${dateStr}.${ext}`;
}

/**
 * 将指定DOM节点截图为PNG并触发浏览器下载
 * @param {HTMLElement} element - 需要截图的DOM节点
 * @param {string} fileName - 图表名称
 * @returns {Promise<boolean>} 成功返回true，失败返回false
 */
export async function exportAsImage(element, fileName) {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#fff',
    });
    const link = document.createElement('a');
    link.download = getFormattedFileName(fileName, 'png');
    link.href = canvas.toDataURL('image/png');
    link.click();
    return true;
  } catch (error) {
    console.error('导出图片失败:', error);
    return false;
  }
}

/**
 * 将指定DOM节点截图后生成PDF并触发浏览器下载
 * 根据截图宽高比计算PDF尺寸
 * @param {HTMLElement} element - 需要截图的DOM节点
 * @param {string} fileName - 图表名称
 * @returns {Promise<boolean>} 成功返回true，失败返回false
 */
export async function exportAsPdf(element, fileName) {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#fff',
    });
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    // 根据截图宽高比计算PDF尺寸，宽度固定为A4宽度210mm
    const pdfWidth = 210;
    const pdfHeight = (imgHeight / imgWidth) * pdfWidth;
    const pdf = new jsPDF({
      orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(getFormattedFileName(fileName, 'pdf'));
    return true;
  } catch (error) {
    console.error('导出PDF失败:', error);
    return false;
  }
}

/**
 * 将数据数组导出为Excel文件
 * @param {Array<Object>} data - 数据数组
 * @param {Array<{title: string, dataIndex: string}>} columns - 列定义数组
 * @param {string} fileName - 图表名称
 * @returns {Promise<boolean>} 成功返回true，失败返回false
 */
export async function exportAsExcel(data, columns, fileName) {
  try {
    // 根据列定义重构数据，将dataIndex映射为title作为表头
    const header = columns.map((col) => col.title);
    const rowData = data.map((item) =>
      columns.map((col) => item[col.dataIndex] ?? '')
    );
    const worksheetData = [header, ...rowData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, getFormattedFileName(fileName, 'xlsx'));
    return true;
  } catch (error) {
    console.error('导出Excel失败:', error);
    return false;
  }
}
