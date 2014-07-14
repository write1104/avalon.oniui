/**
  * @description tab组件，实现扫描DOM结构或者接受数组传参，生成tab，支持click、mouseenter事件响应切换，支持mouseenter情形延迟响应切换，支持click情形tab选中情况下再次点击回调，支持自动切换效果，支持tab增删禁用启用并可混合设置同步tab可删除状态，支持混合配制panel内容类型并支持panel内容是ajax配置回调
  *
  */
define(["avalon","text!./avalon.tab.html", "text!./avalon.tab.panels.html", "text!./avalon.tab.close.html", "css!./avalon.tab.css", "css!../chameleon/oniui-common.css"], function(avalon, template, panelTpl, closeTpl) {

    // 对模板进行转换
    function _getTemplate(tpl, vm) {
        return tpl.replace(/MS_[A-Z_0-9]+/g, function(mat) {
            var mat = (mat.split("MS_OPTION_")[1]||"").toLowerCase().replace(/_[^_]/g, function(mat) {
                return mat.replace(/_/g, "").toUpperCase()
            })
            // 防止事件绑定覆盖，可能匹配不对，但是不会影响实际效果
            if(mat == "event" && vm[mat]) {
                var m, eventId
                if(m = tpl.match(new RegExp(" ms\-" + vm[mat] + "[^\'\\\"]", "g"))) {
                    eventId = m.length
                    m = m.join(",")
                    while(m.match(new RegExp(eventId, "g"))) {
                        eventId++
                    }
                    return vm[mat] + "-" + eventId
                }
            } else if(mat == "removable") {
                return closeTpl
            }
            return vm[mat] || ""
        })
    }

    function _getData(par, type) {
        var res = []
        for (var i = 0; el = par && par.children[i++]; ) {
            if(el.tagName.toLowerCase() != type) continue
            var opt = avalon(el).data()
                , obj = type == "div" ? {
                    content: opt.content || el.innerHTML,
                    contentType: opt.contentType || "content"
                } : {
                    title: el.innerHTML,
                    removable: opt.removable,
                    disabled: opt.disabled == void 0 ? false : opt.disabled
                }
            var href = opt.href || el.getAttribute("href")
            if(href) obj.href = href
            res.push(obj)
        }
        return res
    }

    var widget = avalon.ui.tab = function(element, data, vmodels) {
        var options = data.tabOptions 
            , tabpanels = []
            , tabs = []
            , tabsParent

        // 遍历tabs属性，设置disabled属性，防止在IE里面出错
        avalon.each(options.tabs, function(i, item) {
            item.disabled = !!item.disabled
        })
        // 扫描获取tabs
        if(options.tabs == void 0) {
            tabsParent = options.tabContainerGetter(element)
            tabs = _getData(tabsParent, "li")
            // 销毁dom
            if(options.distroyDom) element.removeChild(tabsParent)
        }
        // 扫描获取panels
        if(options.tabpanels == void 0) {
            panelsParent = options.panelContainerGetter(element)
            tabpanels = _getData(panelsParent, "div")
            if(options.distroyDom) {
                try{
                    element.removeChild(panelsParent)
                }catch(e){}
            }
        }

        var vmodel = avalon.define(data["tabId"], function(vm) {
            vm.$skipArray = [/*"disable", "enable", "add", "activate", "remove", "getTemplate", */"widgetElement", "callInit"/*, "onActivate", "onAjaxCallback"*/]


            vm.tabs = []
            vm.tabpanels = []

            avalon.mix(vm, options)
            vm.widgetElement = element
           
            var inited
                , switchTimer
            vm.$init = function(force) {
                if(inited || !force && !vm.callInit) return
                inited = true

                vm.tabs = options.tabs ? vm.tabs : tabs
                vm.tabpanels = options.tabpanels ? vm.tabpanels : tabpanels
                vm.active = vm.active >= vm.tabs.length && vm.tabs.length - 1 || vm.active < 0 && 0 || parseInt(vm.active) >> 0

                avalon.nextTick(function() {
                    avalon(element).addClass("ui-tab ui-widget ui-widget-content" + (vm.event == "click" ? " ui-tab-click" : "") + (vm.dir == "v" ? " ui-tab-vertical" : "") + (vm.dir != "v" && vm.uiSize == "small" ? " ui-tab-small" : ""))
                    // tab列表
                    var tabFrag = _getTemplate(vm._getTemplate(0, vm), vm)
                        , panelFrag = _getTemplate(vm._getTemplate("panel", vm), vm)

                    element.innerHTML = vmodel.bottom ? panelFrag + tabFrag : tabFrag + panelFrag
                   
                    avalon.scan(element, [vmodel].concat(vmodels))

                    if(vm.autoSwitch) {
                        vm._autoSwitch();
                    }
                    // callback after inited
                    if(typeof options.onInit === "function" ) {
                        //vmodels是不包括vmodel的 
                        options.onInit.call(element, vmodel, options, vmodels)
                    }
                })
            }

            vm._clearTimeout = function() {
                clearTimeout(switchTimer)
            }

            // 选中tab
            vm.activate = function(event, index, fix) {
                // 猥琐的解决在ie里面报找不到成员的bug
                !fix && event.preventDefault()
                if (vm.tabs[index].disabled === true) {
                    return
                }
                var el = this
                // event是click，点击激活状态tab
                if (vm.event === "click" && vm.active === index) {
                    // 去除激活状态
                    if(vm.collapsible) {
                        vm.active = NaN
                    // 调用点击激活状态tab回调
                    } else {
                        options.onClickActive.call(el, event, vmodel)
                    }
                    return
                }
                if (vm.active !== index) {
                    avalon.nextTick(function() {
                        vm.active = index
                        options.onActivate.call(el, event, vmodel)
                    })
                }
            }
            // 延迟切换效果
            if(vm.event == "mouseenter" && vm.activeDelay) {
                var timer
                    , tmp = vm.activate
                vm.activate = function($event, $index) {
                    clearTimeout(timer)
                    var el = this
                        , arg = arguments
                    timer = setTimeout(function() {
                        tmp.apply(el, [$event, $index, "fix event bug in ie"])
                    }, vm.activeDelay)
                    if(!el.getAttribute("leave-binded") && 0) {
                        el.setAttribute("leave-binded", 1)
                        avalon.bind(el, "mouseleave", function() {
                            clearTimeout(timer)
                        })
                    }
                }
            }

            // 自动切换效果
            vm._autoSwitch = function() {
                clearTimeout(switchTimer)
                if(vm.tabs.length < 2) return
                switchTimer = setTimeout(function() {
                    var i = vm.active + 1
                        // 防止死循环
                        , loop = 0
                    while(i != vm.active && loop < vm.tabs.length - 1) {
                        if(i >= vm.tabs.length) {
                            i = 0
                        }
                        if(!vm.tabs[i].disabled) {
                            vm.active = i
                            vm._autoSwitch()
                            break
                        }
                        i++
                        loop++
                    }
                }, vm.autoSwitch)
            }


            //清空构成UI的所有节点，一下代码继承自pilotui
            vm.$remove = function() {
                element.innerHTML = element.textContent = ""
            }
            // 修改使用了avalon的几个方法
            //@method disable(index) 禁用索引指向的tab，index为数字或者元素为数字的数组
            vm.disable = function(index, disable) {
                disable = disable == void 0 ? true : disable
                if(!(index instanceof Array)) {
                    index = [index]
                }
                var total = vm.tabs.length
                avalon.each(index, function(i, idx) {
                    if (idx >= 0 && total > idx) {
                        vm.tabs[idx].disabled = disable
                    }
                })
            }
            //@method enable(index) 启用索引指向的tab，index为数字或者元素为数字的数组
            vm.enable = function(index) {
                vm.disable(index, false)
            }
            //@method add(config) 新增tab, config = {title: "tab title", removable: bool, disabled: bool, content: "panel content", contentType: "ajax" or "content"}
            vm.add = function(config) {
                var title = config.title || "Tab Tile"
                var content = config.content || "<div></div>"
                var exsited = false
                vm.tabpanels.forEach(function(panel) {
                    if (panel.contentType == "include" && panel.content == config.content) {
                        exsited = true
                    }
                })
                if (exsited === true) {
                    return
                }
                vm.tabpanels.push({
                    content: content,
                    contentType: config.contentType
                })
                vm.tabs.push({
                    title: title,
                    removable: config.removable,
                    disabled: false
                })
                if (config.actived) {
                    avalon.nextTick(function() {
                        vmodel.active = vmodel.tabs.length - 1
                    })
                }
            }
            //@method remove(e, index) 删除索引指向的tab，绑定情形下ms-click="remove($event, index)"，js调用则是vm.remove(index)
            vm.remove = function(e, index) {
                if(arguments.length == 2) {
                    e.preventDefault()
                    e.stopPropagation()
                } else {
                    index = e
                }
                if (vmodel.tabs[index].disabled === true || vmodel.tabs[index].removable === false || vmodel.tabs[index].removable == void 0 && !vm.removable) {
                    return
                }
                vmodel.tabs.removeAt(index)
                vmodel.tabpanels.removeAt(index)
                index = index > 1 ? index - 1 : 0
                avalon.nextTick(function() {
                    vmodel.active = index
                })
                vm.bottom = options.bottom
            }

            vm._canRemove = function(tab) {
                return (tab.removable == true || tab.removable !== false && vm.removable) && !tab.disabled && vm.dir != "v"
            }

            vm._canActive = function(tab, $index) {
                return vm.active == $index && !tab.disabled
            }

            vm._isAjax = function(panel) {
                return vm.contentType=="content" && !panel.contentType || panel.contentType=="content"
            }
            vm._cutCounter = function() {
                return (vmodel.dir == "h" || vmodel.forceCut) && vmodel.titleCutCount
            }
            vm._shallPanelAlwaysShow = function($index) {
                return vmodel.shallPanelAlwaysShow || $index === vmodel.active
            }
            return vm
        })


        if(vmodel.autoSwitch) {
            /*
            vmodel.tabs.$watch("length", function(value, oldValue) {
                if(value < 2) {
                    vmodel._clearTimeout()
                } else {
                    vmodel._autoSwitch()
                }
            })
            */
            avalon.bind(element, "mouseenter", function() {
                vmodel._clearTimeout()
            })
            avalon.bind(element, "mouseleave", function() {
                vmodel._clearTimeout()
                vmodel._autoSwitch()
            })
            vmodel.$watch("autoSwitch", function(value, oldValue) {
                vmodel._clearTimeout()
                if(value) {
                    vmodel._autoSwitch()
                }
            })
        }

        // return vmodel使符合框架体系，可以自动调用
        return vmodel
    }

    widget.defaults = {
        toggle: true, //@param 组件是否显示，可以通过设置为false来隐藏组件
        autoSwitch: false,      //@param 是否自动切换，默认否，如果需要设置自动切换，请传递整数，例如200，即200ms
        active: 0,              //@param 默认选中的tab，默认第一个tab，可以通过动态设置该参数的值来切换tab，并可通过vmodel.tabs.length来判断active是否越界
        shallPanelAlwaysShow: false,//@param shallPanelAlwaysShow() panel不通过display:none,block来切换，而是一直显示，通过其他方式切换到视野，默认为false
        event: "mouseenter",    //@param  tab选中事件，默认mouseenter
        removable: false,      //@param  是否支持删除，默认否，另外可能存在某些tab可以删除，某些不可以删除的情况，如果某些tab不能删除则需要在li元素或者tabs数组里给对应的元素指定removable : false，例如 li data-removable="false" or {title: "xxx", removable: false}
        activeDelay: 0,         //@param  比较适用于mouseenter事件情形，延迟切换tab，例如200，即200ms
        collapsible: false,     //@param  当切换面板的事件为click时，如果对处于激活状态的按钮再点击，将会它失去激活并且对应的面板会收起来,再次点击它时，它还原，并且对应面板重新出现
        contentType: "content", //@param  panel是静态元素，还是需要通过异步载入，还可取值为ajax，但是需要给对应的panel指定一个正确的ajax地址
        bottom: false,          //@param  tab显示在底部
        dir: "h",          //@param  tab排列方向，横向或纵向v - vertical，默认横向h - horizontal
        callInit: true,         //@param  是否调用即初始化
        titleCutCount: 8,       //@param  tab title截取长度，默认是8
        distroyDom: true,       //@param  扫描dom获取数据，是否销毁dom
        cutEnd: "...",          //@param  tab title截取字符后，连接的字符，默认为省略号
        forceCut: false,        //@param  强制截断，因为竖直方向默认是不截取的，因此添加一个强制截断，使得在纵向排列的时候title也可以被截断
        //tabs:undefined,              //@param  [{title:"xx", disabled:boolen, removable:boolen}]，单个tabs元素的removable针对该元素的优先级会高于组件的removable设置
        //tabpanels:undefined,         //@param  [{content:content or url, contentType: "content" or "ajax"}] 单个panel的contentType配置优先级高于组件的contentType
        //@optMethod onInit(vmodel, options, vmodels) 完成初始化之后的回调,call as element's method
        onInit: avalon.noop,
        tabContainerGetter: function(element) {
            return element.getElementsByTagName("ul")[0] || element.getElementsByTagName("ol")[0]
        }, //@optMethod tabContainerGetter(element) tab容器，如果指定，则到该容器内扫描tabs，参数为绑定组件的元素，默认返回element内第一个ul或者ol元素
        panelContainerGetter: function(element) {
            return element.getElementsByTagName("div")[0] || element
        }, //@optMethod panelContainerGetter(element)  panel容器，如果指定，则到该容器内扫描panel，参数为绑定组件的元素，默认返回第element内第一个div元素
        onActivate: avalon.noop,  //@optMethod onActivate(event, vmode) 选中tab后的回调，this指向对应的li元素，参数是事件对象，vm对象 fn(event, vmode)，默认为avalon.noop
        onClickActive: avalon.noop, //@optMethod onClickActive(event, vmode)  点击选中的tab，适用于event是"click"的情况，this指向对应的li元素，参数是事件对象，vm对象 fn(event, vmode)，默认为avalon.noop
        onAjaxCallback: avalon.noop, //@optMethod onAjaxCallback  panel内容是ajax，ajax响应后的回调函数，this指向对应的panel元素，无参数，默认为空函数
        // 获取模板，防止用户自定义的getTemplate方法没有返回有效的模板
        _getTemplate: function (tplName, vm) {
            var tpl
                , defineTpl
            if(tplName == "panel") {
                tpl = panelTpl
            } else if(tplName == "close") {
                tpl = closeTpl
            } else {
                tpl = template
            }
            defineTpl = vm.getTemplate(tpl, vm, tplName)
            return  defineTpl || defineTpl === "" ? defineTpl : tpl
        },
        getTemplate: function (template, vm, tplName) {
            return template
        }, //@optMethod getTemplate(template, vm, tplName)  修改模板的接口，参数分别是模板字符串，vm对象，模板名字，返回如果是空字符串则对应的tplName(close,panel,tab)返回为空，return false,null,undedined等于返回组件自带的模板，其他情况为返回值，默认返回组件自带的模板
        _tabTitle : function (title, tab, count, end) {
            var cut
            if(tab.titleCutCount != void 0) {
                cut = tab.titleCutCount
            } else if(count != void 0) {
                cut = count
            }
            if(!cut) return title
            var visibleTitle = title.split(/<[^>]+>/g)
                , len = 0
                , res = 0
                , indexToIgnore
            avalon.each(visibleTitle, function(i, item) {
                if(indexToIgnore >= 0) {
                    res = ""
                } else {
                    var s = item.trim()
                    if(len + s.length > cut) {
                        indexToIgnore = i
                        res = s.substr(0, cut - len) + end
                    } else {
                        len += s.length
                        res = 0
                    }
                }
                if(res === 0) return
                title = title.replace(item, res)
            })
            return title

        }, // 实现截取title逻辑
        // 保留实现配置
        // switchEffect: function() {},     // 切换效果
        // useSkin: false,                  // 载入神马皮肤
        "$author":"skipper@123"
    }
})