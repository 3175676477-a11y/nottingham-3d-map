# Nottingham 3D Map

以 Sherwood Hall 为中心的 Three.js 校园探索原型，采用 Vite。需要 Node.js 20.19+ 或 22.12+；本环境使用 Node.js 24。

## 开发

```sh
npm ci --cache /tmp/nottingham-npm-cache --no-audit --no-fund
npm run dev -- --port 5173
```

WASD / 方向键移动，Shift 加速。点击「开始探索」锁定鼠标并环视，Esc 释放。锁定后使用准星点击建筑查看信息；未锁定时可以拖动视角并点击建筑。「重置」回到入口。碰撞只覆盖建筑轴对齐包围盒和场景边界；树木为装饰，没有碰撞。玩家固定在地面，不支持楼内探索。

```sh
npm test
npm run build
```

## 数据与准确性

**这是概念场景，不是测绘地图，也不能用于真实导航。** Sherwood Hall 是用户指定的探索中心。所有建筑尺寸、高度、立面、相对位置、道路及植被均为占位；侧翼和周边建筑名称仅为演示标签，不能据此推断真实校园关系。界面、建筑标签和信息面板均标注了占位状态。平面图的北向也是示意。

公开参考入口（本次云环境访问返回 403，内容未核验）：

- 诺丁汉大学住宿官网：https://www.nottingham.ac.uk/accommodation/
- University Park 地图：https://www.nottingham.ac.uk/about/visitorinformation/mapsanddirections/universitypark.aspx

后续可依据可访问的官方地图、建筑公开资料和许可明确的地理数据替换 `src/main.js` 的建筑数据，保留来源、采集日期和误差说明。

## 实现

Three.js 本地依赖，无地图 API、令牌或后端服务要求。固定眼高 1.7 m；移动向量归一化避免斜走加速，按帧时间计算速度。碰撞以半径 0.7 m 扩张建筑范围，细分移动防穿墙，分轴处理允许沿墙滑动。失焦时清空按键状态。小地图显示当前位置与视线方向。生产构建生成 `dist/`。
