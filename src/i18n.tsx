import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Language = 'zh' | 'en'
const storageKey = 'magnetic-physics.language'
const chinese: Record<string, string> = {
  'Magnetic Localization': '磁定位', 'Observatory': '观测台',
  'Magnetic Localization Observatory': '磁定位观测台',
  'Physics Playground': '物理演示', 'Synthetic Demo': '合成演示',
  'Interface language': '界面语言', 'Model details': '模型说明', 'Close model details': '关闭模型说明',
  'Source code': '源代码', 'Parameters': '参数', 'Scene': '场景', 'Observations': '观测',
  'Target magnet': '目标磁铁', 'Reset physics': '重置物理参数',
  'Position': '位置', 'Array frame · mm': '阵列坐标系 · mm', 'Magnetization axis': '磁化轴',
  'Target x': '目标 x', 'Target y': '目标 y', 'Target z': '目标 z',
  'Azimuth': '方位角', 'Elevation': '仰角', 'Dipole moment': '磁偶极矩',
  'External field': '外部磁场', 'Interfering dipole': '干扰偶极子',
  'Source x': '干扰源 x', 'Source y': '干扰源 y', 'Source z': '干扰源 z',
  'Source moment': '干扰源磁偶极矩', 'Source azimuth': '干扰源方位角', 'Source elevation': '干扰源仰角',
  'Uniform background Bx': '均匀背景 Bx', 'Uniform background By': '均匀背景 By', 'Uniform background Bz': '均匀背景 Bz',
  'Array geometry': '阵列几何', 'Rows': '行数', 'Columns': '列数',
  'Array rows': '阵列行数', 'Array columns': '阵列列数', 'Column pitch': '列间距', 'Row pitch': '行间距',
  'Field vectors': '磁场向量', 'Field lines': '磁力线', 'Field section': '磁场截面',
  'Section height': '截面高度', 'Sensor IDs': '传感器编号', 'Array axes': '阵列坐标轴',
  'Magnet axes': '磁铁坐标轴', 'Vector density': '向量密度',
  'All sensors': '所有传感器', 'Every second': '每隔 2 个传感器', 'Every fifth': '每隔 5 个传感器',
  'Isometric view': '等轴测视图', 'Top view': '俯视图', 'Reset camera': '重置相机',
  'Drag magnet': '拖动磁铁', 'Export scene image': '导出场景图像', 'Expand scene': '全屏场景',
  'Scene layers': '场景图层', 'Sensor observations': '传感器观测', 'Predicted': '预测',
  'Sensor': '传感器', 'row': '行', 'col': '列', 'Array top view': '阵列俯视图',
  'Field component': '磁场分量', 'Field magnitude': '磁场模长',
  'Field Bx': '磁场 Bx', 'Field By': '磁场 By', 'Field Bz': '磁场 Bz',
  '−X ← columns → +X': '−X ← 列 → +X', 'Rows: −Y → +Y ↓': '行：−Y → +Y ↓',
  'Field contributions': '磁场分量来源', 'Target': '目标', 'Interferer': '干扰源', 'Background': '背景',
  'Superposition': '线性叠加', 'Sensor ID': '传感器编号', 'Array field profile': '阵列磁场分布',
  'All sources': '全部磁源', 'Target axis': '目标磁化轴', 'Export values': '导出数值',
  'Ideal point dipole': '理想点偶极子', 'Right-handed XYZ · Z up': '右手 XYZ · Z 向上',
  'Undefined': '未定义', '5-DoF': '5-DoF', 'slider': '滑块',
  '3D renderer unavailable': '3D 渲染器不可用',
  'Numeric values remain available.': '数值观测仍可查看。',
  'Normalized vector length': '向量长度归一化', 'Array = World': '阵列 = 世界坐标系',
  'Section: sensor color limits': '截面：沿用传感器色标范围',
  'B = μ₀/(4πr³) [3(m·r̂)r̂ − m].': 'B = μ₀/(4πr³) [3(m·r̂)r̂ − m]。',
  'Positions are in mm; calculations use m, A·m² and µT. Values within 5 mm of a point source are undefined.': '位置单位为 mm；计算使用 m、A·m² 与 µT。距点源 5 mm 内的数值未定义。',
  'The unit magnetization axis has two orientation degrees of freedom. Axial spin is not an independently observable sixth degree of freedom.': '磁化单位轴具有两个姿态自由度。绕磁化轴的自转不是可独立观测的第六自由度。',
  'The array is a generic synthetic grid. Array and World coincide here; source glyph dimensions are illustrative.': '阵列为通用合成网格。此处阵列坐标系与世界坐标系重合；磁源图形尺寸仅作示意。',
  'Field lines are RK4 integral curves, not particle trajectories. Section colors are clipped to the sensor color limits.': '磁力线为 RK4 数值积分曲线，并非粒子轨迹。截面颜色按传感器色标范围截断。',
  'Only analytic synthetic fields are included. No experimental recordings, inverse solver, hardware control or accuracy claims are included.': '此应用仅包含解析合成磁场，不包含实验记录、逆求解器、硬件控制或精度主张。',
}

export const translate = (key: string, language: Language): string => language === 'zh' && Object.hasOwn(chinese, key) ? chinese[key] : key
export function initialLanguage(search: string, stored: string | null): Language {
  const query = new URLSearchParams(search).get('lang')
  return query === 'zh' || query === 'en' ? query : stored === 'en' ? 'en' : 'zh'
}
const Context = createContext({ language: 'zh' as Language, setLanguage: (_next: Language) => {}, t: (key: string) => translate(key, 'zh') })
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, update] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'zh'
    let stored = null
    try { stored = localStorage.getItem(storageKey) } catch { /* Disabled storage is supported. */ }
    return initialLanguage(location.search, stored)
  })
  const setLanguage = useCallback((next: Language) => {
    update(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Keep in-memory selection. */ }
    const url = new URL(location.href); url.searchParams.set('lang', next)
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])
  const t = useCallback((key: string) => translate(key, language), [language])
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    document.title = t('Magnetic Localization Observatory')
    document.querySelector('meta[name="description"]')?.setAttribute('content', language === 'zh'
      ? '交互式磁偶极子物理演示与传感器阵列可视化。仅合成数据。'
      : 'Interactive magnetic dipole physics and sensor-array visualization. Synthetic data only.')
  }, [language, t])
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export const useI18n = () => useContext(Context)
