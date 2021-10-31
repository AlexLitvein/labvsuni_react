import React, { useState, useEffect, useRef } from "react";
import { ChartCursor } from "./ChartCursor";
import { Axle, SvgMarker } from "./SvgComps";
import { TextGroup } from "./SvgTextGroup";

const SvgChart = ({ options, axis, dataSets = [] }) => {
    console.log('call SvgChart');

    // TODO: resize padding

    let opt = options;
    const [w, setW] = useState(320);
    const [h, setH] = useState(320);

    // WARNING: ширину линии использовать кратную 2 пикселям, координаты целочисоенные
    const cut = (n) => Math.trunc(n);
    const _clientRect = () => { // oreder!
        return {
            left: options.padding.left,
            top: options.padding.top,
            right: w - options.padding.right,
            bottom: h - options.padding.bottom
        };
    }

    opt.rcClient = _clientRect();
    opt.numHSeg = dataSets.length !== 0 ? dataSets[0]._id.length - 1 : 1;
    opt.lnHSeg = cut((opt.rcClient.right - opt.rcClient.left) / opt.numHSeg);
    let lnVSeg = cut((opt.rcClient.bottom - opt.rcClient.top) / (options.countVLabels - 1));

    let numMainVLine = 2;
    let numMainHLine = 2;

    const svgElm = useRef(null);
    const txtRef = useRef(null);

    const _getOrthoPath = (x, y, size, numSeg, type) => {
        let d = `M${cut(x)} ${cut(y)}`;
        let pos = type === 'H' ? x : y;
        let lnSeg = cut(size / numSeg);
        for (let i = 1; i <= numSeg; i++) {
            d += type + cut(pos + lnSeg * i);
        }
        return d;
    }

    const buildAxlePath = (rc, type) => {
        return _getOrthoPath(
            rc.left,
            // type === 'H' ? rc.bottom : rc.top,
            type === 'H' ? rc.top + (lnVSeg * (options.countVLabels - 1)) : rc.top,
            type === 'H' ? (rc.right - rc.left) : (rc.bottom - rc.top),
            type === 'H' ? opt.numHSeg : options.countVLabels - 1,
            type
        );
    }

    const calcPadding = () => {
        let szHText = { width: 0, height: 0 };
        let szVText = { width: 0, height: 0 };
        for (const key in axis) {
            const el = axis[key]; //_id: { name: 'Дата', min: 0, max: 0, type: 'H', cls: 'axis', clrPath: '#000ff00' },

            if (el.type === 'H') {
                if (dataSets.length !== 0) {
                    let dataObj = dataSets[0];
                    szHText = opt.getStrBoundSize(_formatDateStr(dataObj[key][0]));
                }

            } else {
                const tmp = opt.getStrBoundSize(el.max);
                szVText = tmp.width > szVText.width ? tmp : szVText;
            }
        }
        console.log(`szHText ${szHText} szVText ${szVText}`);
    }

    opt.getStrBoundSize = (str) => {
        let bbox = { width: 0, height: 0 };
        if (txtRef.current) {
            txtRef.current.innerHTML = str;
            bbox = txtRef.current.getBBox();
            // console.log('txtRef.current', txtRef.current);
            opt.fontBBoxHeight = bbox.height;
        }
        return { width: bbox.width, height: bbox.height };
    }

    // data = [num1 , num2 , num3 , ...]
    const buildSvgAniPath = (rc, min, max, data) => {
        // const rc = clientRect();
        let val = 0;
        // let lnSeg = (rc.right - rc.left) / (data.length - 1);
        let res = { do: 'M', to: 'M' };

        for (let i = 0; i < data.length; i++) {
            val = data[i];
            val = Math.round(((val - min) / (max - min)) * (rc.bottom - rc.top));
            res.do += `${cut(rc.left + opt.lnHSeg * i)} ${cut(rc.bottom)}`;
            res.to += `${cut(rc.left + opt.lnHSeg * i)} ${cut(rc.bottom - val)}`;

            if (i < data.length - 1) {
                res.do += 'L';
                res.to += 'L';
            }
        }
        return res;
    }

    const renderPathAxis = (rc, axis) => {
        const out = [];
        for (const key in axis) {
            const el = axis[key];
            out.push(
                <Axle d={buildAxlePath(rc, el.type)} cls={el.cls} />
            );
        }
        return out;
    }

    const _formatDateStr = (str) => {
        let data = new Date(str);
        let dataStr = ('0' + data.getHours()).slice(-2) + '/' + ('0' + data.getDate()).slice(-2) + '/' + ('0' + (data.getMonth() + 1)).slice(-2) + '/' + data.getFullYear() % 100;
        return dataStr;
    }

    const renderVTextAxis = (rc, dataFieldText, arrDataSets) => {
        let dx = cut(options.fontBBoxHeight >> 2);
        let arrStrs = arrDataSets.length !== 0 ? arrDataSets[0][dataFieldText] : [];

        const tmpStr = _formatDateStr(arrStrs[0]);
        const sz = opt.getStrBoundSize(tmpStr);
        opt.padding.bottom = Math.max(opt.padding.bottom, sz.width + options.axisTxtOffs * 2);

        arrStrs = arrStrs.map((el) => { // el = 2021-01-04T15:00:00.034Z           
            return _formatDateStr(el);
        });

        return <TextGroup x={rc.left + dx} y={rc.bottom + options.axisTxtOffs} orient={'V'} offsX={opt.lnHSeg} offsY={0} texts={arrStrs} />;
    }

    const renderHTextAxle = (x, y, axle) => {
        const arrStrs = [];
        let delta = (Math.abs(axle.min) + axle.max) / (options.countVLabels - 1);
        arrStrs.push(axle.max);

        const sz = opt.getStrBoundSize(axle.max);
        opt.padding.left = Math.max(opt.padding.left, sz.width + options.axisTxtOffs * 2);

        for (let i = 1; i <= options.countVLabels - 2; i++) {
            arrStrs.push(axle.max - i * delta);
        }
        arrStrs.push(axle.min);
        return <TextGroup x={x} y={y} orient={'H'} offsX={0} offsY={lnVSeg} texts={arrStrs} clr={axle.clrPath} />;
    }

    const renderHTextAxis = (rc) => {
        const res = [];
        let cntAxis = Object.keys(axis).length - 1; // -1 тк первая ось горизонтальная
        // let dy = options.fontBBoxHeight * 1;
        let startPos = cut(rc.top - ((cntAxis * options.fontBBoxHeight) / 2) * 1.15);
        for (const key in axis) {
            if (axis[key].type === 'H') {
                continue;
            }
            res.push(renderHTextAxle(rc.left - options.axisTxtOffs, startPos += options.fontBBoxHeight, axis[key]));
        }
        return res;
    }

    function resize() {
        let { width, height } = svgElm.current.parentElement.getBoundingClientRect();
        // возвращаются float коорд
        setW(cut(width));
        setH(cut(height));

        // console.log('resize height', height);
    }

    // ===========================
    // input
    // { 
    //      _id: ['2021-11-05', ...], 
    //      t:   [21.2, ...],
    //      p:   [36.9 ...],
    //      h:   [12.5 ...]
    // }
    const renderDataSet = (obj) => {
        const out = [];
        let min = 0, max = 0, clrPath = '';
        for (const key in obj) {
            const el = obj[key]; // [21.2, ...]
            if (axis[key].type === 'H') {
                continue;
            }
            ({ min, max, clrPath } = axis[key]);
            const res = { ...buildSvgAniPath(opt.rcClient, min, max, el) };
            out.push(
                <>
                    <animate id="ani_p" begin="0s;indefinite" xlinkHref={`#data_${key}`} attributeName="d" dur="0.5" fill="freeze" to={res.to} />
                    <path
                        id={`data_${key}`}
                        className={'path-data'}
                        style={{ stroke: clrPath, marker: `url("#mrk_${key}")` }}
                        d={res.do}>
                    </path>
                </>
            );
        }
        return out;
    }

    const renderMarkers = () => {
        const out = [];
        for (const key in axis) {
            const el = axis[key];
            out.push(
                <SvgMarker id={`mrk_${key}`}
                    cls={`mrk_${key}`}
                    w={8} h={8}
                    refX={4} refY={4}
                    mrkEl={<circle cx="4" cy="4" r="4" style={{ fill: el.clrPath }} />}
                />
            );
        }
        return out;
    }

    useEffect(() => {
        resize();
        calcPadding();
        window.addEventListener('resize', (e) => {
            resize();
        });
    }, []); // componentDidMount()

    return (
        <svg id="graph" ref={svgElm} width={w} height={h}>
            {console.log('draw SvgChart')}

            {/* {console.log('opt.rcClient before', opt.rcClient)} */}

            {/* Для вычисления высоты и ширины текста */}
            <text x={0} y={-70} className="note-text" ref={txtRef}>1234567890aeiouybcdfghjklmnpqrstvwyzW</text>

            <SvgMarker id={"mrkVHAxis"} cls={"mrk-axis"}
                w={2} h={6}
                refX={1} refY={6}
                mrkEl={<line x2="0" y2="6" />}
            />

            {renderMarkers()}
            {renderPathAxis(opt.rcClient, axis)}
            {renderVTextAxis(opt.rcClient, '_id', dataSets)}
            {renderHTextAxis(opt.rcClient)}

            {
                dataSets.map((itm, idx) => {
                    return renderDataSet(itm);
                })
            }

            <ChartCursor svgElm={svgElm} gObj={opt} axis={axis} data={dataSets} />

            {/* {console.log('opt.rcClient after', opt.rcClient)} */}
        </svg>


    );
}

export default SvgChart;