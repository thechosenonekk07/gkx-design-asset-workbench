import React, {createContext, useContext, useLayoutEffect, useRef, useState} from 'react';
import * as R from 'react-aria-components';
import {parseDate, parseTime} from '@internationalized/date';
import {Check, ChevronDown, ChevronLeft, ChevronRight, Search, X, Plus, Minus, Folder, FileText, Upload, Info, CalendarDays, ExternalLink, Link2} from 'lucide-react';
import {COMPONENT_CATALOG} from './componentRegistry.js';
import {ExtendedPreview,EXTENDED_KINDS} from './ExtendedPreview.jsx';
import {AssetButton} from './AssetButton.jsx';
import './component-preview.css';
import {resolveComponentConfig,safeLinkHref} from './componentConfig.js';

const TOKEN_NAMES = ['primary','primary-hover','primary-pressed','on-primary','surface','text','muted','border','border-width','radius','height','font-family','font-size','font-weight','line-height','gap','focus','focus-width','focus-offset','disabled-opacity','duration','easing','danger','success','warning','shadow'];
const PreviewRoot = createContext(null);
function usePortalStyle() {
  const root = useContext(PreviewRoot);
  const [style,setStyle] = useState({});
  useLayoutEffect(() => {
    if (!root?.current) return;
    const computed = getComputedStyle(root.current);
    const next = Object.fromEntries(TOKEN_NAMES.map(name => [`--asset-${name}`,computed.getPropertyValue(`--asset-${name}`).trim()]).filter(([,value]) => value));
    setStyle(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
  });
  return style;
}
function Popover({children,...props}) { const style=usePortalStyle(); return <R.Popover className="asset-popover" style={style} {...props}>{children}</R.Popover>; }
function Tooltip({children}) { const style=usePortalStyle(); return <R.Tooltip className="asset-popover asset-tooltip" style={style}>{children}</R.Tooltip>; }
function Modal({children,isDismissable=true}) { const style=usePortalStyle(); return <R.ModalOverlay className="asset-modal-overlay" style={style} isDismissable={isDismissable}><R.Modal className="asset-modal">{children}</R.Modal></R.ModalOverlay>; }
function Button({children,variant='secondary',className='',...props}) {return <R.Button type="button" className={`ap-button ap-${variant==='quiet'?'ghost':variant} ${className}`} {...props}>{children}</R.Button>;}
function Checkbox({children,...props}) { return <R.Checkbox className="ap-checkbox" {...props}>{({isSelected,isIndeterminate})=><><span className="ap-check" aria-hidden="true">{isIndeterminate?<Minus size={12}/>:isSelected?<Check size={12}/>:null}</span>{children}</>}</R.Checkbox>; }
function Radio({children,...props}) {return <R.Radio className="ap-radio" {...props}><span className="ap-radio-dot" aria-hidden="true"/>{children}</R.Radio>;}
function DateInput({slot}) {return <R.DateInput slot={slot} className="ap-date-input">{segment=><R.DateSegment segment={segment} className="ap-date-segment"/>}</R.DateInput>;}
function CalendarContents() {return <><header className="ap-calendar-head"><Button slot="previous" aria-label="上个月"><ChevronLeft size={15}/></Button><R.Heading/><Button slot="next" aria-label="下个月"><ChevronRight size={15}/></Button></header><R.CalendarGrid className="ap-calendar-grid"><R.CalendarGridHeader>{day=><R.CalendarHeaderCell>{day}</R.CalendarHeaderCell>}</R.CalendarGridHeader><R.CalendarGridBody>{date=><R.CalendarCell date={date} className="ap-calendar-cell"/>}</R.CalendarGridBody></R.CalendarGrid></>;}
function safeDate(value) { try {return parseDate(typeof value==='string'?value:'2026-09-17');} catch {return parseDate('2026-09-17');} }
function safeTime(value) { try {return parseTime(typeof value==='string'?value:'09:30');} catch {return parseTime('09:30');} }
function safeColor(value) {try{return R.parseColor(typeof value==='string'?value:'#315BD6');}catch{return R.parseColor('#315BD6');}}
function names(keys) {return keys==='all'?'全部':[...keys].join('、')||'无';}

function EditDialogSample({config,initialValue,onSave}) {
  const [draft,setDraft]=useState(String(initialValue??''));
  return <R.Dialog className="ap-dialog">{({close})=><>
    <R.Heading slot="title">{config.label}</R.Heading>
    {config.description&&<p>{config.description}</p>}
    <R.TextField className="ap-field" value={draft} onChange={setDraft}>
      <R.Label>{config.fieldLabel||'显示名称'}</R.Label><R.Input className="ap-input"/>
    </R.TextField>
    <small className="ap-help">仅演示本地交互。</small>
    <div className="ap-actions"><Button onPress={close}>取消</Button><Button variant="primary" onPress={()=>{onSave(draft);close();}}>{config.confirmLabel||'保存'}</Button></div>
  </>}</R.Dialog>;
}

class PreviewBoundary extends React.Component {
  state={error:null};
  static getDerivedStateFromError(error) {return {error};}
  componentDidCatch(error) {this.props.onEvent?.(`组件样本错误：${error.message}`);}
  render(){return this.state.error?<div className="ap-error" role="alert"><strong>样本未能正常渲染</strong><p>{this.state.error.message}</p><button onClick={()=>this.setState({error:null})}>重试样本</button></div>:this.props.children;}
}

/** Real React Aria examples. Preview state is deliberately separate from saved asset configuration. */
export function ComponentPreview({kind,config={},compact=false,onEvent}) {
  const root=useRef(null);
  const entry=COMPONENT_CATALOG.find(item=>item.kind===kind);
  const resolved=resolveComponentConfig(kind,config,entry?.config);
  return <div ref={root} className={`asset-preview${compact?' asset-preview-compact':''}`} data-kind={kind} data-size={resolved.size||'medium'}>
    <PreviewRoot.Provider value={root}><R.I18nProvider locale="zh-CN"><PreviewBoundary key={`${kind}:${JSON.stringify(resolved)}`} onEvent={onEvent}>
      <>{EXTENDED_KINDS.has(kind)?<ExtendedPreview kind={kind} config={resolved} compact={compact} onEvent={onEvent}/>:<PreviewExample kind={kind} config={resolved} compact={compact} onEvent={onEvent}/>}</>
    </PreviewBoundary></R.I18nProvider></PreviewRoot.Provider>
  </div>;
}

function PreviewExample({kind,config:c,compact,onEvent}) {
  const options=Array.isArray(c.options)?[...new Set(c.options.map(String).filter(Boolean))]:['选项一','选项二','选项三'];
  const label=c.label||'通用组件';
  const disabled=!!c.disabled;
  const [message,setMessage]=useState('');
  const [value,setValue]=useState(c.value??'');
  const [selected,setSelected]=useState(new Set());
  const [items,setItems]=useState(options);
  const [sort,setSort]=useState({column:'name',direction:'ascending'});
  const [activeTab,setActiveTab]=useState(options.includes(String(c.value))?String(c.value):options[0]);
  const [color,setColor]=useState(()=>safeColor(c.value));
  const [date,setDate]=useState(()=>safeDate(c.value));
  const [range,setRange]=useState(()=>({start:safeDate(c.value),end:safeDate(c.value).add({days:7})}));
  const [time,setTime]=useState(()=>safeTime(c.value));
  const report=text=>{setMessage(text);onEvent?.(text);};
  const change=next=>{setValue(next);report(`当前值：${Array.isArray(next)?next.join(' – '):String(next)}`);};
  const selection=keys=>{const normalized=keys==='all'?new Set(options):keys;setSelected(normalized);report(`已选择：${names(normalized)}`);};
  const colorChange=next=>{setColor(next);report(`当前颜色：${next.toString('hex')}`);};
  const fieldProps={isDisabled:disabled,isRequired:!!c.required};
  const choices=options.map(item=><R.ListBoxItem key={item} id={item} textValue={item} className="ap-option">{item}</R.ListBoxItem>);
  const readFiles=files=>{const list=files?[...files].map(file=>file.name):[];setValue(list.join('、'));report(list.length?`已在本地选择 ${list.length} 个文件：${list.join('、')}`:'未选择文件');};
  let sample;
  switch(kind) {
    case 'button': {sample=<AssetButton config={c} isDisabled={disabled} onPress={()=>report(`已触发：${label}（样本本地事件）`)}>{label}</AssetButton>;break;}
    case 'toggle-button': sample=<R.ToggleButton className="ap-button ap-toggle" isDisabled={disabled} isSelected={!!value} onChange={next=>{setValue(next);report(next?'已收藏':'已取消收藏');}}>{!!value&&<Check size={15}/>} {label}</R.ToggleButton>;break;
    case 'link': {const linkClass=`ap-link ap-link-${c.status||'normal'}`;const href=safeLinkHref(c.href);const external=c.external||c.target==='_blank';const rel=[...new Set(`${c.rel||''} ${c.target==='_blank'?'noopener noreferrer':''}`.trim().split(/\s+/))].join(' ');sample=<span className="ap-link-preview" onClickCapture={event=>event.preventDefault()} onAuxClickCapture={event=>event.preventDefault()}><R.Link className={linkClass} href={href} target={c.target||'_self'} rel={rel||undefined} isDisabled={disabled} data-hoverable={c.hoverable!==false} data-underline={c.underline||'hover'} aria-label={c.target==='_blank'?`${label}（新窗口）`:undefined} onPress={()=>report(`导航演示：${label} → ${href}（预览留在工作台）`)}>{c.icon&&<Link2 size={14} aria-hidden="true"/>}{label}{external?<ExternalLink size={13} aria-hidden="true"/>:c.suffix!==false&&<ChevronRight size={14} aria-hidden="true"/>}</R.Link></span>;break;}
    case 'breadcrumbs': sample=<R.Breadcrumbs aria-label={label} className="ap-breadcrumbs">{options.map((item,index)=><R.Breadcrumb key={item}>{index>0&&<ChevronRight size={12} aria-hidden="true"/>}<R.Link className="ap-link" onPress={()=>report(`当前位置：${item}`)}>{item}</R.Link></R.Breadcrumb>)}</R.Breadcrumbs>;break;
    case 'tabs': sample=<R.Tabs className="ap-tabs" isDisabled={disabled} selectedKey={activeTab} onSelectionChange={key=>{setActiveTab(String(key));report(`已切换到：${key}`)}}><R.TabList aria-label={label}>{options.map(item=><R.Tab key={item} id={item}>{item}</R.Tab>)}</R.TabList>{options.map(item=><R.TabPanel key={item} id={item}><strong>{item}</strong><p>在这里查看与调整{item}。</p></R.TabPanel>)}</R.Tabs>;break;
    case 'menu': sample=<R.MenuTrigger><Button isDisabled={disabled}>{label}<ChevronDown size={15}/></Button><Popover><R.Menu aria-label={label} className="ap-menu" onAction={key=>report(`已执行：${key}`)}>{options.map(item=><R.MenuItem key={item} id={item} className="ap-option">{item}</R.MenuItem>)}</R.Menu></Popover></R.MenuTrigger>;break;
    case 'toolbar': sample=<R.Toolbar aria-label={label} className="ap-toolbar">{options.map(item=><R.ToggleButton key={item} className="ap-button ap-toggle" isDisabled={disabled} onChange={next=>report(`${item}：${next?'开启':'关闭'}`)}>{item}</R.ToggleButton>)}</R.Toolbar>;break;
    case 'text-field': sample=<R.TextField className="ap-field" {...fieldProps} isInvalid={!!c.invalid} value={String(value)} onChange={change}><R.Label>{label}{c.required?' *':''}</R.Label><R.Input placeholder={c.placeholder||'请输入'} className="ap-input"/>{c.description&&<R.Text slot="description" className="ap-help">{c.description}</R.Text>}<R.FieldError className="ap-error-text">{c.errorMessage||'请输入有效内容。'}</R.FieldError></R.TextField>;break;
    case 'search-field': sample=<R.SearchField className="ap-field" {...fieldProps} value={String(value)} onChange={change} onSubmit={next=>report(next?`搜索关键词：${next}`:'请输入关键词')} onClear={()=>report('已清空关键词')}><R.Label>{label}</R.Label><R.Group className="ap-input-group"><Search size={16}/><R.Input placeholder={c.placeholder||'输入关键词'} className="ap-input"/><Button aria-label="清空搜索"><X size={14}/></Button></R.Group><R.FieldError className="ap-error-text"/></R.SearchField>;break;
    case 'number-field': sample=<R.NumberField className="ap-field" {...fieldProps} value={Number(value)||0} minValue={Number(c.min??0)} maxValue={Number(c.max??100)} step={Number(c.step)||1} onChange={change}><R.Label>{label}</R.Label><R.Group className="ap-input-group"><Button slot="decrement" aria-label="减少"><Minus size={14}/></Button><R.Input className="ap-input"/><Button slot="increment" aria-label="增加"><Plus size={14}/></Button></R.Group><R.FieldError className="ap-error-text"/></R.NumberField>;break;
    case 'checkbox': sample=<Checkbox {...fieldProps} isSelected={!!value} onChange={change}>{label}</Checkbox>;break;
    case 'checkbox-group': sample=<R.CheckboxGroup className="ap-field" {...fieldProps} onChange={next=>report(`已选择：${next.join('、')||'无'}`)}><R.Label>{label}</R.Label>{options.map(item=><Checkbox key={item} value={item}>{item}</Checkbox>)}<R.FieldError className="ap-error-text"/></R.CheckboxGroup>;break;
    case 'radio-group': sample=<R.RadioGroup className="ap-field" {...fieldProps} defaultValue={options[0]} onChange={next=>report(`已选择：${next}`)}><R.Label>{label}</R.Label>{options.map(item=><Radio key={item} value={item}>{item}</Radio>)}<R.FieldError className="ap-error-text"/></R.RadioGroup>;break;
    case 'switch': sample=<R.Switch className="ap-switch" isDisabled={disabled} isSelected={!!value} onChange={change}><span className="ap-switch-track" aria-hidden="true"><span/></span>{label}</R.Switch>;break;
    case 'select': sample=<R.Select className="ap-field" {...fieldProps} selectedKey={options.includes(String(value))?String(value):null} placeholder={c.placeholder||'请选择'} onSelectionChange={next=>change(next)}><R.Label>{label}</R.Label><Button><R.SelectValue/><ChevronDown size={15}/></Button>{c.description&&<R.Text slot="description" className="ap-help">{c.description}</R.Text>}<Popover><R.ListBox className="ap-listbox" renderEmptyState={()=>'暂无选项'}>{choices}</R.ListBox></Popover><R.FieldError className="ap-error-text">{c.errorMessage||'请选择有效选项。'}</R.FieldError></R.Select>;break;
    case 'combo-box': sample=<R.ComboBox className="ap-field" {...fieldProps} onSelectionChange={next=>next&&report(`已选择：${next}`)}><R.Label>{label}</R.Label><R.Group className="ap-input-group"><R.Input className="ap-input" placeholder={c.placeholder||'输入关键词'}/><Button aria-label="展开选项"><ChevronDown size={15}/></Button></R.Group><Popover><R.ListBox className="ap-listbox" renderEmptyState={()=>'没有匹配结果'}>{choices}</R.ListBox></Popover><R.FieldError className="ap-error-text"/></R.ComboBox>;break;
    case 'list-box': sample=<R.ListBox aria-label={label} className="ap-listbox ap-bordered" selectionMode="single" disabledKeys={disabled?options:[]} selectedKeys={selected} onSelectionChange={selection}>{choices}</R.ListBox>;break;
    case 'grid-list': sample=<R.GridList aria-label={label} className="ap-gridlist" selectionMode="multiple" disabledKeys={disabled?options:[]} selectedKeys={selected} onSelectionChange={selection}>{options.map(item=><R.GridListItem key={item} id={item} textValue={item} className="ap-griditem"><Checkbox slot="selection"/><span className="ap-avatar" aria-hidden="true">{item[0]}</span><span>{item}</span></R.GridListItem>)}</R.GridList>;break;
    case 'table': {const rows=options.map((name,index)=>({id:name,name,role:['设计师','产品经理','工程师'][index%3]})).sort((a,b)=>{const x=a[sort.column].localeCompare(b[sort.column],'zh');return sort.direction==='ascending'?x:-x;});sample=<div className="ap-table-wrap"><R.Table aria-label={label} className="ap-table" selectionMode="multiple" selectedKeys={selected} disabledKeys={disabled?options:[]} onSelectionChange={selection} sortDescriptor={sort} onSortChange={next=>{setSort(next);report(`已按${next.column==='name'?'姓名':'角色'}${next.direction==='ascending'?'升序':'降序'}排列`);}}><R.TableHeader><R.Column><Checkbox slot="selection" aria-label="选择所有成员"/></R.Column><R.Column id="name" isRowHeader allowsSorting>姓名 {sort.column==='name'?(sort.direction==='ascending'?'↑':'↓'):''}</R.Column><R.Column id="role" allowsSorting>角色 {sort.column==='role'?(sort.direction==='ascending'?'↑':'↓'):''}</R.Column></R.TableHeader><R.TableBody items={rows} renderEmptyState={()=>'暂无成员'}>{row=><R.Row id={row.id}><R.Cell><Checkbox slot="selection" aria-label={`选择${row.name}`}/></R.Cell><R.Cell>{row.name}</R.Cell><R.Cell>{row.role}</R.Cell></R.Row>}</R.TableBody></R.Table><div className="ap-table-actions"><span role="status">{selected.size?`已选择 ${selected.size} 项`:'支持多选与取消选择'}</span>{selected.size>0&&<Button onPress={()=>selection(new Set())}>取消选择</Button>}</div></div>;break;}
    case 'tree': sample=<R.Tree aria-label={label} className="ap-tree" selectionMode="single" defaultExpandedKeys={['root']} disabledKeys={disabled?['root',...options]:[]} onSelectionChange={selection} onExpandedChange={keys=>report(`展开的目录：${names(keys)}`)}><R.TreeItem id="root" textValue={label}><R.TreeItemContent>{({isExpanded})=><><Button slot="chevron" aria-label={isExpanded?'折叠目录':'展开目录'}>{isExpanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</Button><Folder size={16}/>{label}</>}</R.TreeItemContent>{options.map(item=><R.TreeItem key={item} id={item} textValue={item}><R.TreeItemContent><FileText size={15}/>{item}</R.TreeItemContent></R.TreeItem>)}</R.TreeItem></R.Tree>;break;
    case 'tag-group': sample=<R.TagGroup className="ap-field" aria-label={label} onRemove={keys=>{setItems(old=>old.filter(item=>!keys.has(item)));report(`已移除：${names(keys)}`);}}><R.Label>{label}</R.Label><R.TagList className="ap-tags" renderEmptyState={()=>'已移除全部标签'}>{items.map(item=><R.Tag key={item} id={item} textValue={item} isDisabled={disabled} className="ap-tag">{item}<Button slot="remove" aria-label={`移除${item}`}><X size={12}/></Button></R.Tag>)}</R.TagList></R.TagGroup>;break;
    case 'disclosure': sample=<R.Disclosure className="ap-disclosure" isDisabled={disabled} defaultExpanded={!!value} onExpandedChange={next=>report(next?'已展开说明':'已收起说明')}><R.Heading><Button slot="trigger">{label}<ChevronDown size={15}/></Button></R.Heading><R.DisclosurePanel>支持使用键盘或鼠标展开。这里可以沉淀使用条件、内容规范与注意事项。</R.DisclosurePanel></R.Disclosure>;break;
    case 'disclosure-group': sample=<R.DisclosureGroup className="ap-disclosure-group" isDisabled={disabled} onExpandedChange={keys=>report(`已展开：${names(keys)}`)}>{options.map(item=><R.Disclosure key={item} id={item} className="ap-disclosure"><R.Heading><Button slot="trigger">{item}<ChevronDown size={15}/></Button></R.Heading><R.DisclosurePanel>进入对应设置，完成修改后保存；变更将作用于当前工作区。</R.DisclosurePanel></R.Disclosure>)}</R.DisclosureGroup>;break;
    case 'dialog': sample=<R.DialogTrigger><Button isDisabled={disabled}>{label}</Button><Modal><EditDialogSample config={c} initialValue={value} onSave={next=>{setValue(next);report(`已保存：${next||'空值'}（仅本地样本）`);}}/></Modal></R.DialogTrigger>;break;
    case 'alert-dialog': sample=<R.DialogTrigger><Button isDisabled={disabled}>{label}</Button><Modal isDismissable={false}><R.Dialog role="alertdialog" className="ap-dialog">{({close})=><><R.Heading slot="title">{c.title||`确认${label}？`}</R.Heading><p>{c.description||'执行后会影响当前资产，请确认后继续。'}</p><small className="ap-help">仅演示本地交互。</small><div className="ap-actions"><Button autoFocus onPress={()=>{report('已取消操作');close();}}>{c.cancelLabel||'取消'}</Button><Button variant={c.tone==='danger'?'danger':'primary'} onPress={()=>{report(`${c.confirmLabel||'已确认操作'}（仅本地样本）`);close();}}>{c.confirmLabel||'确认'}</Button></div></>}</R.Dialog></Modal></R.DialogTrigger>;break;
    case 'tooltip': sample=<R.TooltipTrigger delay={300} onOpenChange={open=>open&&report('提示已显示')}><Button isDisabled={disabled}><Info size={15}/>{label}</Button><Tooltip>{c.description||'在这里查看补充说明。'}</Tooltip></R.TooltipTrigger>;break;
    case 'popover': sample=<R.DialogTrigger onOpenChange={open=>report(open?'已打开成员信息':'已关闭成员信息')}><Button isDisabled={disabled}>{label}<ChevronDown size={15}/></Button><Popover><R.Dialog className="ap-dialog"><R.Heading slot="title">成员信息</R.Heading><p>{c.description||'林青 · 设计师 · 当前在线'}</p></R.Dialog></Popover></R.DialogTrigger>;break;
    case 'slider': case 'range-slider': {const isRange=kind==='range-slider';const numberValue=isRange?(Array.isArray(value)?value:[20,80]):Number(value)||0;sample=<R.Slider className="ap-slider" aria-label={label} isDisabled={disabled} minValue={Number(c.min??0)} maxValue={Number(c.max??100)} step={Number(c.step)||1} value={numberValue} onChange={change}><div className="ap-slider-label"><R.Label>{label}</R.Label><R.SliderOutput/></div><R.SliderTrack className="ap-slider-track">{({state})=><><div className="ap-slider-line"/>{state.values.map((_,index)=><R.SliderThumb key={index} index={index} className="ap-slider-thumb" aria-label={isRange?(index?'结束值':'开始值'):label}/>)}</>}</R.SliderTrack></R.Slider>;break;}
    case 'progress-bar': case 'meter': {const Control=kind==='meter'?R.Meter:R.ProgressBar;sample=<Control className="ap-progress" value={Math.max(0,Math.min(100,Number(value)||0))}>{({percentage,valueText})=><><div className="ap-slider-label"><R.Label>{label}</R.Label><span>{valueText}</span></div><div className="ap-progress-track"><div style={{width:`${percentage}%`}}/></div></>}</Control>;break;}
    case 'separator': sample=<div className={`ap-separator-sample ${c.orientation==='vertical'?'vertical':''}`}><span>个人文件</span><R.Separator orientation={c.orientation==='vertical'?'vertical':'horizontal'} aria-label={label} className="ap-separator"/><span>共享文件</span></div>;break;
    case 'calendar': sample=<R.Calendar className="ap-calendar" aria-label={label} isDisabled={disabled} value={date} onChange={next=>{setDate(next);report(`已选择日期：${next}`);}}><CalendarContents/></R.Calendar>;break;
    case 'range-calendar': sample=<R.RangeCalendar className="ap-calendar" aria-label={label} isDisabled={disabled} value={range} onChange={next=>{setRange(next);report(`日期范围：${next.start} 至 ${next.end}`);}}><CalendarContents/></R.RangeCalendar>;break;
    case 'date-field': sample=<R.DateField className="ap-field" {...fieldProps} value={date} onChange={next=>{setDate(next);report(`日期：${next||'未设置'}`);}}><R.Label>{label}</R.Label><DateInput/><R.FieldError className="ap-error-text"/></R.DateField>;break;
    case 'time-field': sample=<R.TimeField className="ap-field" {...fieldProps} value={time} onChange={next=>{setTime(next);report(`时间：${next||'未设置'}`);}}><R.Label>{label}</R.Label><DateInput/><R.FieldError className="ap-error-text"/></R.TimeField>;break;
    case 'date-picker': sample=<R.DatePicker className="ap-field" {...fieldProps} value={date} onChange={next=>{setDate(next);report(`日期：${next||'未设置'}`);}}><R.Label>{label}</R.Label><R.Group className="ap-input-group"><DateInput/><Button aria-label="打开日历"><CalendarDays size={16}/></Button></R.Group><Popover><R.Dialog><R.Calendar className="ap-calendar"><CalendarContents/></R.Calendar></R.Dialog></Popover><R.FieldError className="ap-error-text"/></R.DatePicker>;break;
    case 'date-range-picker': sample=<R.DateRangePicker className="ap-field ap-range-field" {...fieldProps} value={range} onChange={next=>{setRange(next);report(next?`日期范围：${next.start} 至 ${next.end}`:'未设置日期范围');}}><R.Label>{label}</R.Label><R.Group className="ap-input-group"><DateInput slot="start"/><span aria-hidden="true">–</span><DateInput slot="end"/><Button aria-label="打开范围日历"><CalendarDays size={16}/></Button></R.Group><Popover><R.Dialog><R.RangeCalendar className="ap-calendar"><CalendarContents/></R.RangeCalendar></R.Dialog></Popover><R.FieldError className="ap-error-text"/></R.DateRangePicker>;break;
    case 'color-area': sample=<div className="ap-color-stack"><span>{label}</span><R.ColorArea aria-label={label} className="ap-color-area" isDisabled={disabled} colorSpace="hsb" xChannel="saturation" yChannel="brightness" value={color} onChange={colorChange}><R.ColorThumb className="ap-color-thumb"/></R.ColorArea><output>{color.toString('hex')}</output></div>;break;
    case 'color-slider': sample=<R.ColorSlider className="ap-color-slider" colorSpace="hsb" channel="hue" isDisabled={disabled} value={color} onChange={colorChange}><R.Label>{label}</R.Label><R.SliderTrack><R.ColorThumb className="ap-color-thumb"/></R.SliderTrack></R.ColorSlider>;break;
    case 'color-field': sample=<R.ColorField className="ap-field" isDisabled={disabled} value={color} onChange={next=>next&&colorChange(next)}><R.Label>{label}</R.Label><R.Input className="ap-input"/></R.ColorField>;break;
    case 'color-picker': sample=<R.ColorPicker value={color} onChange={colorChange}><div className="ap-color-stack"><span>{label}</span><R.ColorArea aria-label="饱和度和亮度" className="ap-color-area" colorSpace="hsb" xChannel="saturation" yChannel="brightness" isDisabled={disabled}><R.ColorThumb className="ap-color-thumb"/></R.ColorArea><R.ColorSlider className="ap-color-slider" colorSpace="hsb" channel="hue" isDisabled={disabled}><R.Label>色相</R.Label><R.SliderTrack><R.ColorThumb className="ap-color-thumb"/></R.SliderTrack></R.ColorSlider><R.ColorField className="ap-field" isDisabled={disabled}><R.Label>颜色值</R.Label><R.Input className="ap-input"/></R.ColorField></div></R.ColorPicker>;break;
    case 'color-swatch': sample=<div className="ap-swatch-line"><R.ColorSwatch className="ap-swatch" color={color} aria-label={label}/><div>{label}<p>{color.toString('hex')}</p></div></div>;break;
    case 'color-swatch-picker': sample=<R.ColorSwatchPicker aria-label={label} className="ap-swatches" value={color} onChange={colorChange}>{options.map((item,index)=><R.ColorSwatchPickerItem key={`${item}-${index}`} className="ap-swatch-item" isDisabled={disabled} color={safeColor(item)}><R.ColorSwatch className="ap-swatch"/></R.ColorSwatchPickerItem>)}</R.ColorSwatchPicker>;break;
    case 'file-trigger': sample=<div className="ap-file-sample"><R.FileTrigger allowsMultiple={!!c.multiple} onSelect={readFiles}><Button isDisabled={disabled}><Upload size={15}/>{label}</Button></R.FileTrigger>{value&&<p>{value}</p>}</div>;break;
    case 'drop-zone': sample=<R.DropZone className="ap-dropzone" isDisabled={disabled} onDrop={async event=>{const files=event.items.filter(item=>item.kind==='file');if(!files.length){report('请选择文件；当前区域不接收纯文本。');return;}const chosen=c.multiple?files:files.slice(0,1);readFiles(await Promise.all(chosen.map(item=>item.getFile())));}}><Upload size={24} aria-hidden="true"/><R.Text slot="label">{value||label}</R.Text><R.FileTrigger allowsMultiple={!!c.multiple} onSelect={readFiles}><Button isDisabled={disabled}>浏览本地文件</Button></R.FileTrigger><small>文件只在本地样本中读取名称</small></R.DropZone>;break;
    default: sample=<div className="ap-error" role="alert">尚未接入的组件类型：{kind}</div>;
  }
  return <div className="ap-example"><div className="ap-stage">{sample}</div>{!compact&&message&&<p className="ap-event" role="status">{message}</p>}</div>;
}

export default ComponentPreview;
