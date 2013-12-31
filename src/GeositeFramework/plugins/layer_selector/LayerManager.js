// Module LayerManager.js

define([
        "dojo/json",
        "use!tv4",
        "use!underscore",
        "./AgsLoader",
        "./WmsLoader"
    ],
    function (JSON, tv4, _, AgsLoader, WmsLoader) {

        var LayerManager = function (app) {
            var _app = app,
                _urls = [],
                _treeRootNode = null, // the absolute base of the tree
                _cssClassPrefix = 'pluginLayerSelector',
                _onLoadingComplete,
                _getUniqueFolderTitle = createFnForUniqueFolderTitles();

            
            /*
              Public Methods
             */
            this.load = loadLayerData;
            this.hideAllLayers = function (map) { hideAllLayersForNode(_treeRootNode, map); };
            this.setServiceState = function (stateObject, map) { setServiceStateForNode(_treeRootNode, stateObject, map); };
            this.getServiceState = function () { return getServiceStateForNode (_treeRootNode); };


            /*
              Private methods
             */
            function loadLayerData(layerSourcesJson, onLoadingComplete) {
                var layerData = parseLayerConfigData(layerSourcesJson);
                //console.log(layerData);

                _onLoadingComplete = onLoadingComplete;

                if (layerData) {
                    _treeRootNode = makeRootNode();

                    // Load layer info from each source
                    _.each(layerData, function (dataSourceContainer) {
                        var loader = null, innerContainer = null, source = null, sourceRootNode = null;

                        // initialize layer data
                        if (dataSourceContainer.agsSource) {
                            source = dataSourceContainer.agsSource;
                            _.each(source.folders, function(folder) {
                                folder.guid = _.uniqueId(folder.name + "_");
                                _.each(folder.services, function(service) {
                                    service.guid = _.uniqueId(service.name + "_");
                                    var url = (_.has(folder, "url")) ? folder.url : source.url;
                                    var url = (folder.name != "") ? url + "/" + folder.name : url;
                                    _urls.push(url + "/" + service.name);

                                });
                            });
                            loader = new AgsLoader(source.url, source);
                            innerContainer = source.folders;

                        } else if (dataSourceContainer.wmsSource) {
                            source = dataSourceContainer.wmsSource;
                            _urls.push(source.url);
                            var extent = _app._unsafeMap.extent;
                            loader = new WmsLoader(source.url, source.folderTitle, source, extent);
                            innerContainer = source.layerIds;
                        }

                        // validate and load, or raise a schema error
                        if ((dataSourceContainer.agsSource) && !(dataSourceContainer.agsSource && dataSourceContainer.wmsSource)) {
                            if (source.folderTitle === "") {
                                sourceRootNode = _treeRootNode;
                            } else {
                                sourceRootNode = makeContainerNode(source.folderTitle, "folder", _treeRootNode);
                            }
                            loadLayerSource(loader, source.url, sourceRootNode, innerContainer);
                        } else if ((dataSourceContainer.wmsSource) && !(dataSourceContainer.agsSource && dataSourceContainer.wmsSource)) {  
                            loadLayerSource(loader, source.url, _treeRootNode, innerContainer);
                        } else { 
                            _app.error("Schema error. Must have a single agsSource or wmsSource in each object.");
                        }

                    });
                }
            }

            function createFnForUniqueFolderTitles () {
                    var assignedNameCounter = 0, duplicateNameCounter = 1, usedNames = [],

                    innerFunction = function (serviceSource) {
                        /*
                          Takes a serviceSource, gets the folderTitle and if it 
                          is not defined, or not unique, it is assigned a unique name.
                        */

                        if (serviceSource.folderTitle === undefined) {
                            return "folder_" + ++assignedNameCounter;
                        } else if (_.contains(usedNames, serviceSource.folderTitle)) {
                            _app.error("", "Cannot have multiple top-level folders with the same name." + "Appending duplicate notice.");
                            return serviceSource.folderTitle + "_(duplicate #" + ++duplicateNameCounter + ")";
                        } else {
                            usedNames.push(serviceSource.folderTitle);
                            return serviceSource.folderTitle;
                        }
                    };

                    return innerFunction;
            }

            function parseLayerConfigData(layerSourcesJson) {
                // Parse and validate config data to get URLs of layer sources
                var errorMessage;
                try {
                    var data = JSON.parse(layerSourcesJson),
                        schema = layerConfigSchema,
                        valid = tv4.validate(data, schema);
                    if (valid) {
                        return data;
                    } else {
                        errorMessage = tv4.error.message + " (data path: " + tv4.error.dataPath + ")";
                    }
                } catch (e) {
                    errorMessage = e.message;
                }
                _app.error("", "Error in config file layers.json: " + errorMessage);
                return null;
            }

            // Schema for validating layers.config file (see http://json-schema.org)

            var layerConfigSchema = {
                $schema: 'http://json-schema.org/draft-04/schema#',
                title: 'layer_selector plugin: layer sources specification',
                type: 'array',
                items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        agsSource: {
                            type: 'object',
                            properties: {
                                url: { type: 'string' },
                                folderTitle: { type: 'string' },
                                folders: {
                                    type: 'array',
                                    items: { 
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['name'],
                                        properties: {
                                            url: { type: 'string' },
                                            name: { type: 'string' },
                                            displayName: { type: 'string' },
                                            groupFolder: { type: 'string' },
                                            groupAsService: { type: 'boolean' },
                                            description: { type: 'string' },
                                            services: { 
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    additionalProperties: false,
                                                    required: ['name', 'type'],
                                                    properties: {
                                                        name: { type: 'string' },
                                                        displayName: { type: 'string' },
                                                        type: { type: 'string' },
                                                        opacity: { type: 'number' },
                                                        visible: { type: 'boolean' },
                                                        description: { type: 'string' },
                                                        id: { type: 'string' },
                                                        showLayers: {
                                                            type: 'array',
                                                            items: {
                                                                type: 'object',
                                                                additionalProperties: false,
                                                                required: ['id'],
                                                                properties: {
                                                                    id: { type: 'integer' },
                                                                    displayName: { type: 'string' },
                                                                    parentLayerId: { type: 'integer' }
                                                                }
                                                            }
                                                        },
                                                        visibleLayerIds: { type: 'array', items: { type: 'integer' } },
                                                        displayLevels: { type: 'array', items: { type: 'integer' } },
                                                        layerIndex: { type: 'integer' },
                                                        mode: { type: 'string' },
                                                        outFields:{ type: 'array', items: { type: 'string' } },
                                                        autoGeneralize: { type: 'boolean' },
                                                        maxAllowableOffset: { type: 'boolean' },
                                                        displayOnPan: { type: 'boolean' },
                                                        layerDefinition: { type: 'string' },
                                                        symbology: {
                                                            type: 'object',
                                                            additionalProperties: false,
                                                            properties: {
                                                                fill: { 
                                                                    type: 'object',
                                                                    additionalProperties: false,
                                                                    properties: {
                                                                        type: { type: 'string' },
                                                                        style: { type: 'string' },
                                                                        color: { type: 'array', items: { type: 'number' } },
                                                                        outline: {
                                                                            type: 'object',
                                                                            additionalProperties: false,
                                                                            properties: {
                                                                                type: { type: 'string' },
                                                                                style: { type: 'string' },
                                                                                color: { type: 'array', items: { type: 'number' } },
                                                                                width: { type: 'number' },
                                                                                cap: { type: 'string' },
                                                                                miter: { type: 'string' },
                                                                                miterLimit: { type: 'string' }
                                                                            }
                                                                        },
                                                                        url: { type: 'string' },
                                                                        height: { type: 'number' },
                                                                        width: { type: 'number' },
                                                                        offset: { 
                                                                            type: 'object',
                                                                            additionalProperties: false,
                                                                            properties: {
                                                                                x: { type: 'number' },
                                                                                y: { type: 'number' }
                                                                            }
                                                                        },
                                                                        xscale: { type: 'number' },
                                                                        yscale: { type: 'number' }
                                                                    }
                                                                },
                                                                line: { 
                                                                    type: 'object',
                                                                    additionalProperties: false,
                                                                    properties: {
                                                                        type: { type: 'string' },
                                                                        style: { type: 'string' },
                                                                        color: { type: 'array', items: { type: 'number' } },
                                                                        width: { type: 'number' },
                                                                        cap: { type: 'string' },
                                                                        miter: { type: 'string' },
                                                                        miterLimit: { type: 'string' }
                                                                    } 
                                                                },
                                                                marker: {
                                                                    type: 'object',
                                                                    additionalProperties: false,
                                                                    properties: {
                                                                        type: { type: 'string' },
                                                                        style: { type: 'string' },
                                                                        color: { type: 'array', items: { type: 'number' } },
                                                                        size: { type: 'integer' },
                                                                        angle: { type: 'number' },
                                                                        outline: {
                                                                            type: 'object',
                                                                            additionalProperties: false,
                                                                            properties: {
                                                                                type: { type: 'string' },
                                                                                style: { type: 'string' },
                                                                                color: { type: 'array', items: { type: 'number' } },
                                                                                width: { type: 'number' },
                                                                                cap: { type: 'string' },
                                                                                miter: { type: 'string' },
                                                                                miterLimit: { type: 'string' }
                                                                            }
                                                                        },
                                                                        url: { type: 'string' },
                                                                        height: { type: 'number' },
                                                                        width: { type: 'number' },
                                                                        offset: { 
                                                                            type: 'object',
                                                                            additionalProperties: false,
                                                                            properties: {
                                                                                x: { type: 'number' },
                                                                                y: { type: 'number' }
                                                                            }
                                                                        }
                                                                    } 
                                                                }
                                                            }
                                                        }                                                       
                                                    }
                                                }
                                            }
                                        }
                                    }
                                },
                                required: ['url'],
                                additionalProperties: false
                            }
                        },
                        wmsSource: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['url', 'folderTitle'],
                            properties: {
                                url: { type: 'string' },
                                folderTitle: { type: 'string' },
                                description: { type: 'string' },
                                resourceInfo: { type: 'boolean' },
                                groupFolder: { type: 'string' },
                                opacity: { type: 'number' },
                                layerIds: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['name'],
                                        properties: {
                                            name: { type: 'string' },
                                            displayName: { type: 'string' },
                                            description: { type: 'string' },
                                            extent: {
                                                type: 'object',
                                                additionalProperties: false,
                                                properties: {
                                                    xmin: { type: 'number' },
                                                    ymin: { type: 'number' },
                                                    xmax: { type: 'number' },
                                                    ymax: { type: 'number' },
                                                    sr: { type: 'integer' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };  

            function loadLayerSource(loader, url, sourceRootNode, folderOrLayerIdWhitelist) {
                //_urls.push(url);
                loader.load(sourceRootNode, folderOrLayerIdWhitelist, makeContainerNode, makeLeafNode, onLayerSourceLoaded, onLayerSourceLoadError);
            }

            function onLayerSourceLoaded(url) {
                // Specified URL is loaded; remove it from the list
                var i = _.indexOf(_urls, url);
                if(i != -1)  { _urls.splice(i, 1); }
                
                if (_urls.length == 0) {
                    // All URLs are loaded
                    _onLoadingComplete(_treeRootNode);
                }
            }

            function onLayerSourceLoadError(jqXHR, textStatus, errorThrown) {
                _app.error("", "AJAX request to load layer source failed: '" + (jqXHR.resultText || jqXHR)
                    + "' Status: '" + textStatus + "' Error: '" + errorThrown + "'");
            }

            // ------------------------------------------------------------------------
            // Functions to build a node tree of map layers. The node schema targets Ext.data.TreeStore 
            // and Ext.tree.Panel, but should be generic enough for other UI frameworks.

            function makeRootNode() {
                var node = {
                    expanded: true,
                    children: []
                };
                return node;
            }

            function makeContainerNode(name, type, parentNode){
                var node = {
                    type: type,
                    cls: _cssClassPrefix + "-" + type, // When the tree is displayed the node's associated DOM element will have this CSS class
                    text: name ? name.replace(/_/g, " ") : "",
                    name: _.uniqueId(name + "_"),
                    leaf: false,
                    children: [],
                    parent: parentNode
                };
                // TODO - I don't know why this was necessary. If parent node is defined,
                // it should always have an array assigned to children. However, when
                // modifying layers.json to only include AGS sources, this error came up.
                if (parentNode.children) {
                    parentNode.children.push(node);
                }
                return node;
            }

            function makeLeafNode(title, layerId, showOrHideLayer, parentNode) {
                var node = {
                    type: "layer",
                    cls: _cssClassPrefix + "-layer", // When the tree is displayed the node's associated DOM element will have this CSS class
                    text: title.replace(/_/g, " ") + ' <div class="pluginLayer-extent-zoom">',
                    leaf: true,
                    checked: false,
                    layerId: layerId,
                    parent: parentNode,
                    showOrHideLayer: showOrHideLayer // function which shows or hides the layer
                };
                if (!parentNode.children) { parentNode.children = []; }
                parentNode.children.push(node);
                return node;
            }

            function hideAllLayersForNode(node, map) {
                if (node.hideAllLayers) {
                    node.hideAllLayers(node, map);
                } else {
                    _.each(node.children, function (child) {
                        hideAllLayersForNode(child, map);
                    });
                }
            }

            function setServiceStateForNode (node, stateObject, map) {
                if (node.setServiceState) {
                    node.setServiceState(node, stateObject, map);
                } else {
                    _.each(node.children, function (child) {
                        setServiceStateForNode(child, stateObject, map);
                    });
                }
            }

            function getServiceStateForNode (rootNode) {
                var stateObject = {};

                function saveServiceStateForNodeInner (node, stateObject) {
                    if (node.saveServiceState) {
                        node.saveServiceState(node, stateObject);
                    } else {
                        _.each(node.children, function (child) {
                            saveServiceStateForNodeInner(child, stateObject);
                        });
                    }
                }
                saveServiceStateForNodeInner(rootNode, stateObject);
                return stateObject;
            }
        };
        return LayerManager;
    }
);
