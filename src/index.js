window.lcjsSmallView = window.devicePixelRatio >= 2
if (!window.__lcjsDebugOverlay) {
    window.__lcjsDebugOverlay = document.createElement('div')
    window.__lcjsDebugOverlay.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.7);color:#fff;padding:4px 8px;z-index:99999;font:12px monospace;pointer-events:none'
    const attach = () => { if (document.body && !window.__lcjsDebugOverlay.parentNode) document.body.appendChild(window.__lcjsDebugOverlay) }
    attach()
    setInterval(() => {
        attach()
        window.__lcjsDebugOverlay.textContent = window.innerWidth + 'x' + window.innerHeight + ' dpr=' + window.devicePixelRatio + ' small=' + window.lcjsSmallView
    }, 500)
}
// Import LightningChartJS
const lcjs = require('@lightningchart/lcjs')

// Extract required parts from LightningChartJS.
const { lightningChart, emptyFill, emptyLine, AutoCursorModes, Themes } = lcjs

const exampleContainer = document.getElementById('chart') || document.body
if (exampleContainer === document.body) {
    exampleContainer.style.width = '100vw'
    exampleContainer.style.height = '100vh'
    exampleContainer.style.margin = '0px'
}
exampleContainer.style.display = 'flex'
exampleContainer.style.flexDirection = 'row'
const containerChart1 = document.createElement('div')
const containerChart2 = document.createElement('div')
exampleContainer.append(containerChart1)
exampleContainer.append(containerChart2)
containerChart1.style.flexGrow = '1'
containerChart1.style.height = '100%'
containerChart2.style.width = '50%'
containerChart2.style.height = '100%'
containerChart2.style.display = 'none'

const lc = lightningChart({
            resourcesBaseUrl: new URL(document.head.baseURI).origin + new URL(document.head.baseURI).pathname + 'resources/',
        })
const chart = lc
    .ChartXY({
        legend: { visible: false },
        container: containerChart1,
        theme: (() => {
    const t = Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined
    return t && window.lcjsSmallView ? lcjs.scaleTheme(t, 0.5) : t
})(),
textRenderer: window.lcjsSmallView ? lcjs.htmlTextRenderer : undefined,
    })
    .setCursorMode(undefined)
    .setTitle('Click to select points, close selection by clicking on polygon corner')
const dataGrid = lc
    .DataGrid({
        container: containerChart2,
        theme: (() => {
    const t = Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined
    return t && window.lcjsSmallView ? lcjs.scaleTheme(t, 0.5) : t
})(),
textRenderer: window.lcjsSmallView ? lcjs.htmlTextRenderer : undefined,
    })
    .setTitle('Selected samples')

const data = new Array(5000).fill(0).map((_, i) => ({ id: i, x: Math.random() ** 2, y: Math.random() ** 1.5 }))

const scatterSeries = chart
    .addPointSeries({
        schema: {
            x: { pattern: null },
            y: { pattern: null },
            size: { pattern: null },
        },
    })
    .appendJSON(data, undefined, { size: 3 })
    .setPointerEvents(false)

// Disable conflicting built-in interactions
chart.setUserInteractions({ rectangleZoom: false })

// Add custom lasso polygon interaction using events API and Polygon series
const polygonSeries = chart.addPolygonSeries({ automaticColorIndex: 2 }).setPointerEvents(false).setCursorEnabled(false)
const polygonFigure = polygonSeries.add([]).setFillStyle((fill) => fill.setA(50))
const polygonMarkers = chart.addPointSeries({ schema: { x: { pattern: null }, y: { pattern: null } } }).setCursorEnabled(false)
let lassoState
chart.seriesBackground.addEventListener('pointermove', (event) => {
    if (!lassoState || lassoState.closed) return
    const coordAxis = chart.translateCoordinate(event, chart.coordsAxis)
    const polygonPreview = [...lassoState.polygon, coordAxis]
    polygonFigure.setDimensions(polygonPreview)
})
chart.seriesBackground.addEventListener('pointerleave', (event) => {
    if (!lassoState || lassoState.closed) return
    polygonFigure.setDimensions(lassoState.polygon)
})
chart.seriesBackground.addEventListener('click', (event) => {
    // Add coordinate to polygon
    const coordAxis = chart.translateCoordinate(event, chart.coordsAxis)
    if (!lassoState || lassoState.closed) {
        lassoState = { polygon: [coordAxis] }
        scatterSeries.fill({ size: 3 })
    } else {
        lassoState.polygon.push(coordAxis)
    }
    polygonFigure.setDimensions(lassoState.polygon)
    polygonMarkers.appendSample(coordAxis)
    dataGrid.removeCells()
})
polygonMarkers.addEventListener('click', (event) => {
    // Close polygon
    lassoState.closed = true
    polygonFigure.setDimensions(lassoState.polygon)
    polygonMarkers.clear()

    // Routine for checking if data point is inside a polygon.
    const coords = lassoState.polygon
    const xMin = coords.reduce((prev, cur) => Math.min(prev, cur.x), Number.MAX_SAFE_INTEGER)
    const xMax = coords.reduce((prev, cur) => Math.max(prev, cur.x), -Number.MAX_SAFE_INTEGER)
    const yMin = coords.reduce((prev, cur) => Math.min(prev, cur.y), Number.MAX_SAFE_INTEGER)
    const yMax = coords.reduce((prev, cur) => Math.max(prev, cur.y), -Number.MAX_SAFE_INTEGER)
    const dataPointSizes = new Array(data.length)
    const dataGridContent = [['ID', 'X', 'Y']]
    for (let i = 0; i < data.length; i += 1) {
        const sample = data[i]
        let insidePolygon = false
        if (sample.x >= xMin && sample.x <= xMax && sample.y >= yMin && sample.y <= yMax) {
            if (getIsPointInsidePolygon(sample, coords)) {
                insidePolygon = true
            }
        }
        dataPointSizes[i] = insidePolygon ? 7 : 3
        if (insidePolygon) {
            dataGridContent.push([sample.id, sample.x.toFixed(3), sample.y.toFixed(3)])
        }
    }
    scatterSeries.alterSamplesStartingFrom(0, { size: dataPointSizes })
    dataGrid.setTableContent(dataGridContent)
    containerChart2.style.display = 'block'
})

// https://stackoverflow.com/a/72434617/9288063
const getIsPointInsidePolygon = (point, vertices) => {
    const x = point.x
    const y = point.y
    let inside = false
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x,
            yi = vertices[i].y
        const xj = vertices[j].x,
            yj = vertices[j].y
        const intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
        if (intersect) inside = !inside
    }
    return inside
}
