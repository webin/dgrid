define(["dojo/_base/html", "dojo/_base/declare", "dojo/listen", "dojo/aspect", "./TextEdit", "dojo/has", "dojo/has!touch?./TouchScroll", "cssx/css!./css/d-list.css"], function(dojo, declare, listen, aspect, TextEdit, has, TouchScroll){
	// allow for custom CSS class definitions 
	// TODO: figure out what to depend for this
	var byId = function(id){
		return document.getElementById(id);
	};
	var create = dojo.create;
	
	return declare(TouchScroll ? [TouchScroll] : [], { 
		constructor: function(params, srcNodeRef){
		var self = this;
		if(typeof params == "function"){
			// mixins/plugins are being provided, we will mix then into the instance 
			var i = 0, mixin;
			while(typeof (mixin = arguments[i++]) == "function"){
				dojo.safeMixin(this, mixin.prototype);
			} 
			// shift the arguments to get the params and srcNodeRef for the new instantiation
			params = arguments[i - 1];
			srcNodeRef = arguments[i];
		}
		// summary:
		//		The set of observers for the data
		this.observers = [];
		this._listeners = [];
		this._rowIdToObject = {};
	clearTop = function(){
		var scrollNode = self.bodyNode;
		var transform = self.contentNode.style.webkitTransform;
		var visibleTop = scrollNode.scrollTop + (transform ? -transform.match(/translate[\w]*\(.*?,(.*?)px/)[1] : 0);
		
		var elements = self.contentNode.childNodes;
		for(var i = 0; i < elements.length; i++){
			if(elements[i].offsetTop > visibleTop){
				break;
			}
		}
		self.otherNode = create("div", {
		});
		var last = elements[i];
		for(; i > 0; i--){
			self.otherNode.appendChild(elements[i -1]);
		}
		var node = create("div", {
			style: {
				height: visibleTop + "px"
			}
		});
		self.contentNode.insertBefore(node, last);
	};
			this.create(params, srcNodeRef);
		},
		minRowsPerPage: 25,
		maxRowsPerPage: 100,
		maxEmptySpace: 10000,
		queryOptions: {},
		query: {},
		createNode: create,
		rowHeight: 0,
		create: function(params, srcNodeRef){
			var domNode = this.domNode = srcNodeRef.nodeType ? srcNodeRef : byId(srcNodeRef);
			this.tabIndex = domNode.getAttribute("tabindex") || 1;
			domNode.role = "grid";
			if(params){
				this.params = params;
				dojo.safeMixin(this, params);
			}

			if(domNode.tagName == "table"){
				// TODO: read layout from table
			}
			domNode.className += "	ui-widget-content dojoxGridx";
			this.refresh();
		},
		refresh: function(){
			var headerNode = this.headerNode = create("div",{
				className: "dojoxGridxHeader dojoxGridxHeaderRow"
			},this.domNode);
			var bodyNode = this.bodyNode = create("div",{
				className: "dojoxGridxScroller"
			},this.domNode);
			listen(bodyNode, "scroll", function(event){
				// keep the header aligned with the body
				headerNode.scrollLeft = bodyNode.scrollLeft;
			});
			this.renderHeader();
			bodyNode.style.top = headerNode.offsetHeight + "px";
			this.refreshContent();
			aspect.after(this, "scrollTo", this.onscroll);
			this.postCreate && this.postCreate();
		},
		on: function(eventType, listener){
			// delegate events to the domNode
			var signal = listen(this.domNode, eventType, listener);
			if(has("dom-addeventlistener")){
				this._listeners.push(signal);
			}
		},
		destroy: function(){
			// cleanup listeners
			for(var i = 0; i < this._listeners.length; i++){
				this._listeners.cancel();
			}
		},
		refreshContent: function(){
			// summary:
			//		refreshes the contents of the table
			if(this.contentNode){
				// remove the content so it can be recreated
				this.bodyNode.removeChild(this.contentNode);
				// remove any listeners
				for(var i = 0;i < this.observers.length; i++){
					this.observers[i].cancel();
				}
				this.observers = [];
			}
			this.contentNode = create("div",{
			}, create("div",{
			},this.bodyNode));
			if(this.init){
				this.init({
					domNode: this.bodyNode,
					containerNode: this.contentNode
				});
			}
			this.preloadNode = null;
		},
		renderCollection: function(results, beforeNode, options){
			// summary:
			//		This renders an array or collection of objects as rows in the table, before the
			//		given node. This will listen for changes in the collection if an observe method
			//		is available (as it should be if it comes from an Observable data store).
			var start = options.start || 0;
			var self = this;
			var contentNode = this.contentNode;
			if(results.observe){
				// observe the results for changes
				this.observers.push(results.observe(function(object, from, to){
					// a change in the data took place
					if(from > -1){
						// remove from old slot
						var tr = rows.splice(from, 1)[0];
						contentNode.removeChild(tr);
					}
					if(to > -1){
						// add to new slot
						var tr = self.createRow(object, rows[to], (options.start + to), options);
						rows.splice(to, 0, tr);
					}
				}));
			}
			// now render the results
			// TODO: if it is raw array, we can't rely on map
			var startTime = new Date().getTime();
			var rows = results.map(function(object){
				return self.createRow(object, beforeNode, start++, options);
			}, console.error);
			console.log("rendered in", new Date().getTime() - startTime);
			return rows;
		},
		_autoId: 0,
		renderHeader: function(){
			// no-op in a place list 
		},
		createRow: function(object, beforeNode, i, options){
			// summary:
			//		Renders a single row in the table
			var row = create("div",{
				className: "dojoxGridxRow " + (i% 2 == 1 ? "dojoxGridxRowOdd" : "dojoxGridxRowEven")
			});
			// get the row id for easy retrieval
			this._rowIdToObject[row.id = this.id + "-row-" + ((this.store && this.store.getIdentity) ? this.store.getIdentity(object) : this._autoId++)] = object;
			this.renderRow(row, object, options);  
			this.contentNode.insertBefore(row, beforeNode);
			return row;
		},
		renderRow: function(row, value){
			row.innerHTML = value;
		},
		getRowNode: function(objectOrId){
			// summary:
			//		Get the row node for an object or id
			if(typeof objectOrId == "object"){
				objectOrId = this.store.getIdentity(objectOrId);
			}
			return byId(this.id + "-row-" + objectOrId);
		},
		getObject: function(node){
			// summary:
			//		Get the object for a given node (can be a row or any child of it)
			node = node.target || node;
			var object;
			do{
				if((object = this._rowIdToObject[node.id])){
					return object;
				}
				node = node.parentNode;
			}while(node && node != this.domNode);
		},
		getObjectId: function(node){
			// summary:
			//		Get the object id for a given node (can be a tr or any child of it)
			node = node.target || node;
			do{
				var rowId = node.id;
				if(this._rowIdToObject[rowId]){
					return rowId.substring(rowId.indexOf("-row-") + 5);
				}
				node = node.parentNode;
			}while(node && node != this.domNode);
		}
	});
});