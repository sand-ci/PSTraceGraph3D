'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var three$1 = require('three');
var ThreeDragControls = _interopDefault(require('three-dragcontrols'));
var ThreeForceGraph = _interopDefault(require('three-forcegraph'));
var ThreeRenderObjects = _interopDefault(require('three-render-objects'));
var accessorFn = _interopDefault(require('accessor-fn'));
var Kapsule = _interopDefault(require('kapsule'));

function styleInject(css, ref) {
  if (ref === void 0) ref = {};
  var insertAt = ref.insertAt;

  if (!css || typeof document === 'undefined') {
    return;
  }

  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';

  if (insertAt === 'top') {
    if (head.firstChild) {
      head.insertBefore(style, head.firstChild);
    } else {
      head.appendChild(style);
    }
  } else {
    head.appendChild(style);
  }

  if (style.styleSheet) {
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
}

var css = ".graph-info-msg {\n  top: 50%;\n  width: 100%;\n  text-align: center;\n  color: lavender;\n  opacity: 0.7;\n  font-size: 22px;\n  position: absolute;\n  font-family: Sans-serif;\n}\n\n.grabbable {\n  cursor: move;\n  cursor: grab;\n  cursor: -moz-grab;\n  cursor: -webkit-grab;\n}\n\n.grabbable:active {\n  cursor: grabbing;\n  cursor: -moz-grabbing;\n  cursor: -webkit-grabbing;\n}";
styleInject(css);

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};
    var ownKeys = Object.keys(source);

    if (typeof Object.getOwnPropertySymbols === 'function') {
      ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) {
        return Object.getOwnPropertyDescriptor(source, sym).enumerable;
      }));
    }

    ownKeys.forEach(function (key) {
      _defineProperty(target, key, source[key]);
    });
  }

  return target;
}

function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread();
}

function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  }
}

function _iterableToArray(iter) {
  if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter);
}

function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance");
}

function linkKapsule (kapsulePropName, kapsuleType) {
  var dummyK = new kapsuleType(); // To extract defaults

  return {
    linkProp: function linkProp(prop) {
      // link property config
      return {
        "default": dummyK[prop](),
        onChange: function onChange(v, state) {
          state[kapsulePropName][prop](v);
        },
        triggerUpdate: false
      };
    },
    linkMethod: function linkMethod(method) {
      // link method pass-through
      return function (state) {
        var kapsuleInstance = state[kapsulePropName];

        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }

        var returnVal = kapsuleInstance[method].apply(kapsuleInstance, args);
        return returnVal === kapsuleInstance ? this // chain based on the parent object, not the inner kapsule
        : returnVal;
      };
    }
  };
}

var three = window.THREE ? window.THREE // Prefer consumption from global THREE, if exists
: {
  AmbientLight: three$1.AmbientLight,
  DirectionalLight: three$1.DirectionalLight
};

var CAMERA_DISTANCE2NODES_FACTOR = 150; //
// Expose config from forceGraph

var bindFG = linkKapsule('forceGraph', ThreeForceGraph);
var linkedFGProps = Object.assign.apply(Object, _toConsumableArray(['jsonUrl', 'graphData', 'numDimensions', 'dagMode', 'dagLevelDistance', 'nodeRelSize', 'nodeId', 'nodeVal', 'nodeResolution', 'nodeColor', 'nodeAutoColorBy', 'nodeOpacity', 'nodeThreeObject', 'nodeThreeObjectExtend', 'linkSource', 'linkTarget', 'linkVisibility', 'linkColor', 'linkAutoColorBy', 'linkOpacity', 'linkWidth', 'linkResolution', 'linkCurvature', 'linkCurveRotation', 'linkMaterial', 'linkThreeObject', 'linkThreeObjectExtend', 'linkPositionUpdate', 'linkDirectionalArrowLength', 'linkDirectionalArrowColor', 'linkDirectionalArrowRelPos', 'linkDirectionalArrowResolution', 'linkDirectionalParticles', 'linkDirectionalParticleSpeed', 'linkDirectionalParticleWidth', 'linkDirectionalParticleColor', 'linkDirectionalParticleResolution', 'forceEngine', 'd3AlphaDecay', 'd3VelocityDecay', 'warmupTicks', 'cooldownTicks', 'cooldownTime', 'onEngineTick', 'onEngineStop'].map(function (p) {
  return _defineProperty({}, p, bindFG.linkProp(p));
})));
var linkedFGMethods = Object.assign.apply(Object, _toConsumableArray(['refresh', 'd3Force'].map(function (p) {
  return _defineProperty({}, p, bindFG.linkMethod(p));
}))); // Expose config from renderObjs

var bindRenderObjs = linkKapsule('renderObjs', ThreeRenderObjects);
var linkedRenderObjsProps = Object.assign.apply(Object, _toConsumableArray(['width', 'height', 'backgroundColor', 'showNavInfo', 'enablePointerInteraction'].map(function (p) {
  return _defineProperty({}, p, bindRenderObjs.linkProp(p));
})));
var linkedRenderObjsMethods = Object.assign.apply(Object, _toConsumableArray(['cameraPosition'].map(function (p) {
  return _defineProperty({}, p, bindRenderObjs.linkMethod(p));
}))); //

var _3dForceGraph = Kapsule({
  props: _objectSpread({
    nodeLabel: {
      "default": 'name',
      triggerUpdate: false
    },
    linkLabel: {
      "default": 'name',
      triggerUpdate: false
    },
    linkHoverPrecision: {
      "default": 1,
      onChange: function onChange(p, state) {
        return state.renderObjs.lineHoverPrecision(p);
      },
      triggerUpdate: false
    },
    enableNavigationControls: {
      "default": true,
      onChange: function onChange(enable, state) {
        var controls = state.renderObjs.controls();

        if (controls) {
          controls.enabled = enable;
        }
      },
      triggerUpdate: false
    },
    enableNodeDrag: {
      "default": true,
      triggerUpdate: false
    },
    onNodeDrag: {
      "default": function _default() {},
      triggerUpdate: false
    },
    onNodeDragEnd: {
      "default": function _default() {},
      triggerUpdate: false
    },
    onNodeClick: {
      "default": function _default() {},
      triggerUpdate: false
    },
    onNodeRightClick: {
      "default": function _default() {},
      triggerUpdate: false
    },
    onNodeHover: {
      "default": function _default() {},
      triggerUpdate: false
    },
    onLinkClick: {
      "default": function _default() {},
      triggerUpdate: false
    },
    onLinkRightClick: {
      "default": function _default() {},
      triggerUpdate: false
    },
    onLinkHover: {
      "default": function _default() {},
      triggerUpdate: false
    }
  }, linkedFGProps, linkedRenderObjsProps),
  methods: _objectSpread({
    pauseAnimation: function pauseAnimation(state) {
      if (state.animationFrameRequestId !== null) {
        cancelAnimationFrame(state.animationFrameRequestId);
        state.animationFrameRequestId = null;
      }

      return this;
    },
    resumeAnimation: function resumeAnimation(state) {
      if (state.animationFrameRequestId === null) {
        this._animationCycle();
      }

      return this;
    },
    _animationCycle: function _animationCycle(state) {
      if (state.enablePointerInteraction) {
        // reset canvas cursor (override dragControls cursor)
        this.renderer().domElement.style.cursor = null;
      } // Frame cycle


      state.forceGraph.tickFrame();
      state.renderObjs.tick();
      state.animationFrameRequestId = requestAnimationFrame(this._animationCycle);
    },
    scene: function scene(state) {
      return state.renderObjs.scene();
    },
    // Expose scene
    camera: function camera(state) {
      return state.renderObjs.camera();
    },
    // Expose camera
    renderer: function renderer(state) {
      return state.renderObjs.renderer();
    },
    // Expose renderer
    controls: function controls(state) {
      return state.renderObjs.controls();
    },
    // Expose controls
    tbControls: function tbControls(state) {
      return state.renderObjs.tbControls();
    },
    // To be deprecated
    _destructor: function _destructor() {
      this.pauseAnimation();
      this.graphData({
        nodes: [],
        links: []
      });
    }
  }, linkedFGMethods, linkedRenderObjsMethods),
  stateInit: function stateInit(_ref5) {
    var controlType = _ref5.controlType,
        rendererConfig = _ref5.rendererConfig;
    return {
      forceGraph: new ThreeForceGraph(),
      renderObjs: ThreeRenderObjects({
        controlType: controlType,
        rendererConfig: rendererConfig
      })
    };
  },
  init: function init(domNode, state) {
    // Wipe DOM
    domNode.innerHTML = ''; // Add relative container

    domNode.appendChild(state.container = document.createElement('div'));
    state.container.style.position = 'relative'; // Add renderObjs

    var roDomNode = document.createElement('div');
    state.container.appendChild(roDomNode);
    state.renderObjs(roDomNode);
    var camera = state.renderObjs.camera();
    var renderer = state.renderObjs.renderer();
    var controls = state.renderObjs.controls();
    controls.enabled = !!state.enableNavigationControls;
    state.lastSetCameraZ = camera.position.z; // Add info space

    var infoElem;
    state.container.appendChild(infoElem = document.createElement('div'));
    infoElem.className = 'graph-info-msg';
    infoElem.textContent = ''; // config forcegraph

    state.forceGraph.onLoading(function () {
      infoElem.textContent = 'Loading...';
    });
    state.forceGraph.onFinishLoading(function () {
      infoElem.textContent = ''; // sync graph data structures

      state.graphData = state.forceGraph.graphData(); // re-aim camera, if still in default position (not user modified)

      if (camera.position.x === 0 && camera.position.y === 0 && camera.position.z === state.lastSetCameraZ && state.graphData.nodes.length) {
        camera.lookAt(state.forceGraph.position);
        state.lastSetCameraZ = camera.position.z = Math.cbrt(state.graphData.nodes.length) * CAMERA_DISTANCE2NODES_FACTOR;
      } // Setup node drag interaction


      if (state.enableNodeDrag && state.enablePointerInteraction && state.forceEngine === 'd3') {
        // Can't access node positions programatically in ngraph
        var dragControls = new ThreeDragControls(state.graphData.nodes.map(function (node) {
          return node.__threeObj;
        }), camera, renderer.domElement);
        dragControls.addEventListener('dragstart', function (event) {
          controls.enabled = false; // Disable controls while dragging

          var node = event.object.__data;
          node.__initialFixedPos = {
            fx: node.fx,
            fy: node.fy,
            fz: node.fz
          }; // lock node

          ['x', 'y', 'z'].forEach(function (c) {
            return node["f".concat(c)] = node[c];
          }); // keep engine running at low intensity throughout drag

          state.forceGraph.d3AlphaTarget(0.3); // drag cursor

          renderer.domElement.classList.add('grabbable');
        });
        dragControls.addEventListener('drag', function (event) {
          state.ignoreOneClick = true; // Don't click the node if it's being dragged

          var node = event.object.__data; // Move fx/fy/fz (and x/y/z) of nodes based on object new position

          ['x', 'y', 'z'].forEach(function (c) {
            return node["f".concat(c)] = node[c] = event.object.position[c];
          }); // prevent freeze while dragging

          state.forceGraph.resetCountdown();
          state.onNodeDrag(node);
        });
        dragControls.addEventListener('dragend', function (event) {
          var node = event.object.__data;
          var initPos = node.__initialFixedPos;

          if (initPos) {
            ['x', 'y', 'z'].forEach(function (c) {
              var fc = "f".concat(c);

              if (initPos[fc] === undefined) {
                node[fc] = undefined;
              }
            });
            delete node.__initialFixedPos;
            state.onNodeDragEnd(node);
          }

          state.forceGraph.d3AlphaTarget(0) // release engine low intensity
          .resetCountdown(); // let the engine readjust after releasing fixed nodes

          if (state.enableNavigationControls) {
            controls.enabled = true; // Re-enable controls
          } // clear cursor


          renderer.domElement.classList.remove('grabbable');
        });
      }
    }); // config renderObjs

    var getGraphObj = function getGraphObj(object) {
      var obj = object; // recurse up object chain until finding the graph object

      while (obj && !obj.hasOwnProperty('__graphObjType')) {
        obj = obj.parent;
      }

      return obj;
    };

    state.renderObjs.objects([// Populate scene
    new three.AmbientLight(0xbbbbbb), new three.DirectionalLight(0xffffff, 0.6), state.forceGraph]).hoverOrderComparator(function (a, b) {
      // Prioritize graph objects
      var aObj = getGraphObj(a);
      if (!aObj) return 1;
      var bObj = getGraphObj(b);
      if (!bObj) return -1; // Prioritize nodes over links

      var isNode = function isNode(o) {
        return o.__graphObjType === 'node';
      };

      return isNode(bObj) - isNode(aObj);
    }).tooltipContent(function (obj) {
      var graphObj = getGraphObj(obj);
      return graphObj ? accessorFn(state["".concat(graphObj.__graphObjType, "Label")])(graphObj.__data) || '' : '';
    }).onHover(function (obj) {
      // Update tooltip and trigger onHover events
      var hoverObj = getGraphObj(obj);

      if (hoverObj !== state.hoverObj) {
        var prevObjType = state.hoverObj ? state.hoverObj.__graphObjType : null;
        var prevObjData = state.hoverObj ? state.hoverObj.__data : null;
        var objType = hoverObj ? hoverObj.__graphObjType : null;
        var objData = hoverObj ? hoverObj.__data : null;

        if (prevObjType && prevObjType !== objType) {
          // Hover out
          state["on".concat(prevObjType === 'node' ? 'Node' : 'Link', "Hover")](null, prevObjData);
        }

        if (objType) {
          // Hover in
          state["on".concat(objType === 'node' ? 'Node' : 'Link', "Hover")](objData, prevObjType === objType ? prevObjData : null);
        }

        state.hoverObj = hoverObj;
      }
    }).onClick(function (obj) {
      // Handle click events on objects
      if (state.ignoreOneClick) {
        // f.e. because of dragend event
        state.ignoreOneClick = false;
        return;
      }

      var graphObj = getGraphObj(obj);

      if (graphObj) {
        state["on".concat(graphObj.__graphObjType === 'node' ? 'Node' : 'Link', "Click")](graphObj.__data);
      }
    }).onRightClick(function (obj) {
      // Handle right-click events
      var graphObj = getGraphObj(obj);

      if (graphObj) {
        state["on".concat(graphObj.__graphObjType === 'node' ? 'Node' : 'Link', "RightClick")](graphObj.__data);
      }
    }); //
    // Kick-off renderer

    this._animationCycle();
  }
});

module.exports = _3dForceGraph;
