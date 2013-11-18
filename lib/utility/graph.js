/*********************************************************************
 * Basic graph types.  Graphs are defined over generic node objects.
 * Graphs do not own their nodes, they only own their edges.  Thus
 * the same nodes can be reused in multiple graphs.
 *
 * There are two graph types defined:  an undirected graph (Graph)
 * and a directed graph (Digraph).  The graphs are assumed to be
 * bipartite, but only by certain node-walking methods.
 *
 * Node-walking is supported simply by methods which return an array
 * of nodes, which can then be used with the standard array forEach,
 * reduce, map, filter, etc.
 */
m4_module
m4_export(Node,
          Graph,
          Digraph)

/*====================================================================
 * A node is simply an object which can be converted into a unique
 * string (via its toString method).  This allows them to be indexed
 * in a map implemented simply as an object.
 */

function Node( id ) {
  this.id= id;
}

m4_member(Node, toString)
function toString() {
  return this.id;
}

/*====================================================================
 * This is the base type for graphs.  The name "OverlayGraph" is
 * meant to refer to the fact that the graph does not own its nodes;
 * it simply creates a graph by overlaying the node with edges.
 *
 * The one field in this base type is a node dictionary which is
 * used to look up a node given its id.  This node dictionary may
 * contain more nodes than are actually in the graph; thus it can
 * be shared among multiple graphs.
 */

function OverlayGraph( nodeDict ) {
  this.nodeDict= nodeDict;
}

m4_member(OverlayGraph, lookupNode)
function lookupNode( id ) {
  return this.nodeDict[id];
}

// Copies one set of edges into another set of edges.
// It is assumed that the second set is empty.
function copyEdges( e1, e2 ) {
  for (var n1 in e1) {
    var t1= e1[n1];
    var t2= e2[n1]= {};
    for (var n2 in t1) {
      if (t1[n2]) {
        t2[n2]= true;
      }
    }
  }
}

/*====================================================================
 * An undirected graph.
 */

function Graph( nodeDict, base ) {
  OverlayGraph.call( this, nodeDict );
  if (base) {
    this._edges= Object.create( base._edges );
  }
  else {
    this._edges= {};
  }
}
m4_extend(Graph, OverlayGraph)

/*--------------------------------------------------------------------
 * Create a new graph using the same node definitons as this graph.
 */

m4_member(Graph, newGraph)
function newGraph() {
  return new Graph( this.nodeDict );
}

m4_member(Graph, newDigraph)
function newDigraph() {
  return new Digraph( this.nodeDict );
}

/*--------------------------------------------------------------------
 * Create a new graph which shadows this graph
 */
m4_member(Graph, shadow)
function shadow() {
  return new Graph( this.nodeDict, this );
}

/*--------------------------------------------------------------------
 * This is a deep copy in the sense that all edges are copied
 * completely. The result is a brand new graph; not a shadow.
 * Nodes are not copied since they are not owned.
 */
m4_member(Graph, clone)
function clone() {
  var g= new Graph( this.nodeDict );
  copyEdges( this._edges, g._edges );
  return g;
}

/*--------------------------------------------------------------------
 * Test if nodes/edges are present
 */

m4_member(Graph, hasNode)
function hasNode( n ) {
  return n in this._edges;
}

m4_member(Graph, hasOwnNode)
function hasOwnNode( n ) {
  return this._edges.hasOwnProperty( n );
}

m4_member(Graph, hasEdge)
function hasEdge( n1, n2 ) {
  return this.hasNode( n1 ) && this._edges[n1][n2] === true;
}

/*--------------------------------------------------------------------
 * Add nodes/edges
 * Adding guarantees it will be in the shadow regardless of
 *   what's in the base
 */

m4_member(Graph, addNode)
function addNode( n ) {
  if (this.hasNode( n )) {
    if (! this.hasOwnNode( n )) {
      this._edges[n]= Object.create( this._edges[n] );
    }
  }
  else {
    this._edges[n]= {};
  }
  return this;
}

m4_member(Graph, addEdge)
function addEdge( n1, n2 ) {
  this.addNode( n1 );
  this.addNode( n2 );
  this._edges[n1][n2]= true;
  this._edges[n2][n1]= true;
  return this;
}

/*--------------------------------------------------------------------
 * Remove edges
 * Removing guarantees it will not be in the shadow regardless of
 *   what's in the base
 */

m4_member(Graph, removeEdge)
function removeEdge( n1, n2 ) {
  this.addNode( n1 );
  this.addNode( n2 );
  this._edges[n1][n2]= false;
  this._edges[n2][n1]= false;
  return this;
}

/*--------------------------------------------------------------------
 * Reset nodes/edges
 * Resetting returns the shadow to the state of the base
 */

m4_member(Graph, resetNode)
function resetNode( n ) {
  if (this.hasOwnNode( n )) {
    for (var n2 in this._edges[n]) {
      this.resetEdge( n, n2 );
    }
    delete this._edges[n];
  }
  return this;
}

m4_member(Graph, resetEdge)
function resetEdge( n1, n2 ) {
  if (this.hasOwnNode( n1 ) && this.hasOwnNode( n2 )) {
    delete this._edges[n1][n2];
    delete this._edges[n2][n1];
  }
  return this;
}

/*--------------------------------------------------------------------
 * Get all edges for a node
 */

m4_member(Graph, edges)
function edges( n ) {
  var result= [];
  var es= this._edges[n];
  for (n2 in es) {
    if (es[n2]) {
      result.push( this.lookupNode( n2 ) );
    }
  }
  return result;
}

/*--------------------------------------------------------------------
 * Graph walking methods.  Only "walker" is required, the other are
 * simply convenience methods to simplify common queries.
 */

m4_member(Graph, walker)
function walker() {
  return new GraphWalker( this );
}

m4_member(Graph, nodesReachable)
function nodesReachable( starting ) {
  return new GraphWalker( this ).nodesReachable( starting ).result();
}

m4_member(Graph, nodesReachableSameType)
function nodesReachableSameType( starting ) {
  return new GraphWalker( this ).nodesReachableSameType( starting ).result();
}

m4_member(Graph, nodesReachableOtherType)
function nodesReachableOtherType( starting ) {
  return new GraphWalker( this ).nodesReachableOtherType( starting ).result();
}


/*====================================================================
 * A directed graph.  For a given node n, _outs[n] are edges going
 * out from n to other nodes, whereas _ins[n] are edges coming in
 * from other nodes to n.
 */

function Digraph( nodeDict, base ) {
  OverlayGraph.call( this, nodeDict );
  if (base) {
    this._outs= Object.create( base._outs );
    this._ins= Object.create( base._ins );
  }
  else {
    this._outs= {};
    this._ins= {};
  }
}
m4_extend(Digraph, OverlayGraph)

/*--------------------------------------------------------------------
 * Create a new graph using the same node definitions as this graph.
 */

m4_member(Digraph, newGraph)
function newGraph() {
  return new Graph( this.nodeDict );
}

m4_member(Digraph, newDigraph)
function newDigraph() {
  return new Digraph( this.nodeDict );
}

/*--------------------------------------------------------------------
 * Create a new graph which shadows this graph
 */
m4_member(Digraph, shadow)
function shadow() {
  return new Digraph( this.nodeDict, this );
}

/*--------------------------------------------------------------------
 * This is not actually a copy; rather the edges of the new graph
 * inherit from the edges of the original.  This means the new graph
 * will use the original graph's edges, but may override them in
 * certain cases.
 */
m4_member(Digraph, clone)
function clone() {
  var g= new Digraph( this.nodeDict );
  copyEdges( this._ins, g._ins );
  copyEdges( this._outs, g._outs );
  return g;
}

/*--------------------------------------------------------------------
 * Test if nodes/edges are present
 */

m4_member(Digraph, hasNode)
function hasNode( n ) {
  return n in this._outs;
}

m4_member(Digraph, hasOwnNode)
function hasOwnNode( n ) {
  return this._outs.hasOwnProperty( n );
}

m4_member(Digraph, hasEdge)
function hasEdge( from, to ) {
  return this.hasNode( from ) && this._outs[from][to] === true;
}

/*--------------------------------------------------------------------
 * Add nodes/edges
 * Adding guarantees it will be in the shadow regardless of
 *   what's in the base
 */

m4_member(Digraph, addNode)
function addNode( n ) {
  if (this.hasNode( n )) {
    if (! this.hasOwnNode( n )) {
      this._outs[n]= Object.create( this._outs[n] );
      this._ins[n]= Object.create( this._ins[n] );
    }
  }
  else {
    this._outs[n]= {};
    this._ins[n]= {};
  }
  return this;
}

m4_member(Digraph, addEdge)
function addEdge( from, to ) {
  this.addNode( from );
  this.addNode( to );
  this._outs[from][to]= true;
  this._ins[to][from]= true;
  return this;
}

/*--------------------------------------------------------------------
 * Remove edges
 * Removing guarantees it will not be in the shadow regardless of
 *   what's in the base
 */

m4_member(Digraph, removeEdge)
function removeEdge( from, to ) {
  this.addNode( from );
  this.addNode( to );
  this._outs[from][to]= false;
  this._ins[to][from]= false;
  return this;
}

/*--------------------------------------------------------------------
 * Reset nodes/edges
 * Resetting returns the shadow to the state of the base
 */

m4_member(Digraph, resetNode)
function resetNode( n ) {
  if (this.hasOwnNode( n )) {
    for (var to in this._outs[n]) {
      this.resetEdge( n, to );
    }
    for (var from in this._ins[n]) {
      this.resetEdge( from, n );
    }
    delete this._outs[n];
    delete this._ins[n];
  }
  return this;
}

m4_member(Digraph, resetEdge)
function resetEdge( from, to ) {
  if (this.hasOwnNode( from ) && this.hasOwnNode( to )) {
    delete this._outs[from][to];
    delete this._ins[to][from];
  }
  return this;
}

/*--------------------------------------------------------------------
 * Get all nodes/edges
 */

m4_member(Digraph, nodes)
function nodes() {
  return Object.keys( this._ins ).map( this.lookupNode, this );
}

m4_member(Digraph, outs)
function outs( n ) {
  var result= [];
  var os= this._outs[n];
  for (n2 in os) {
    if (os[n2]) {
      result.push( this.lookupNode( n2 ) );
    }
  }
  return result;
}

m4_member(Digraph, ins)
function ins( n ) {
  var result= [];
  var is= this._ins[n];
  for (n2 in is) {
    if (is[n2]) {
      result.push( this.lookupNode( n2 ) );
    }
  }
  return result;
}

/*--------------------------------------------------------------------
 * Graph walking methods.  Only "walker" is required, the other are
 * simply convenience methods to simplify common queries.
 */

m4_member(Digraph, walker)
function walker() {
  return new GraphWalker( this );
}

m4_member(Digraph, nodesUpstream)
function nodesUpstream( starting ) {
  return new GraphWalker( this ).nodesUpstream( starting ).result();
}

m4_member(Digraph, nodesUpstreamSameType)
function nodesUpstreamSameType( starting ) {
  return new GraphWalker( this ).nodesUpstreamSameType( starting ).result();
}

m4_member(Digraph, nodesUpstreamOtherType)
function nodesUpstream( starting ) {
  return new GraphWalker( this ).nodesUpstreamOtherType( starting ).result();
}

m4_member(Digraph, nodesDownstream)
function nodesDownstream( starting ) {
  return new GraphWalker( this ).nodesDownstream( starting ).result();
}

m4_member(Digraph, nodesDownstreamSameType)
function nodesDownstreamSameType( starting ) {
  return new GraphWalker( this ).nodesDownstreamSameType( starting ).result();
}

m4_member(Digraph, nodesDownstreamOtherType)
function nodesDownstream( starting ) {
  return new GraphWalker( this ).nodesDownstreamOtherType( starting ).result();
}

/*====================================================================
 * A node walker is responsible for walking the graph, adding each
 * node it visits into an array.  Several different walks can be
 * performed using the same walker; each node will be added to the
 * array only once.
 *
 * Support for bipartite walking is provided by the "visit" flag.
 * If this value is >= 0, the node is visited.  The walker negates
 * the flag before passing it to its children.  Thus, passing a value
 * of 1 results in only visiting nodes of the same type as the
 * starting node; passing a value of -1 results in only visiting nodes
 * of the opposite type as the starting node; passing a value of 0
 * results in visiting all nodes.
 *
 * Example use:
 *   var targetMethods= sgraph.walker()
 *     .nodesDownstreamSameType( changedMethods )
 *     .nodesDownstreamOtherType( changedVariables )
 *     .result();
 */

function GraphWalker( graph ) {
  this.graph= graph;
  this.visited= {};
  this.collected= [];
}

/*--------------------------------------------------------------------
 * We're through with the walk; return the nodes visited
 */
m4_member(GraphWalker, result)
function result() {
  return this.collected;
}

/*--------------------------------------------------------------------
 * Entry point for a walk
 * Parameters:
 *   edgesProp - the name of the edges property to follow
 *   visit     - the visit flag controlling which nodes we visit
 *   starting  - either a single node or an array of nodes
 *
 * Note that generally you wouldn't call this directly, but instead
 * call one of the helper methods below.
 */
m4_member(GraphWalker, collect)
function collect( edgesProp, visit, starting ) {
  if (Array.isArray( starting )) {
    starting.forEach(
      this.collectRec.bind( this, edgesProp, visit )
    );
  }
  else {
    this.collectRec( edgesProp, visit, starting );
  }
  return this;
}

/*--------------------------------------------------------------------
 * The recursive walking function
 */
m4_member(GraphWalker, collectRec)
function collectRec( edgesProp, visit, n ) {
  if (this.visited[n]) { return; }
  this.visited[n]= true;
  if (visit >= 0) {
    this.collected.push( this.graph.lookupNode( n ) );
  }
  var to= this.graph[edgesProp][n];
  for (n2 in to) {
    if (to[n2]) {
      this.collectRec( edgesProp, -visit, n2 );
    }
  }
}

/*--------------------------------------------------------------------
 * Helper methods for Graph
 */

m4_member(GraphWalker, nodesReachable)
function nodeReachable( starting ) {
  return this.collect( '_edges', 0, starting );
}

m4_member(GraphWalker, nodesReachableSameType)
function nodeReachableSameType( starting ) {
  return this.collect( '_edges', 1, starting );
}

m4_member(GraphWalker, nodesReachableType)
function nodeReachableOtherType( starting ) {
  return this.collect( '_edges', -1, starting );
}

/*--------------------------------------------------------------------
 * Helper methods for Digraph
 */

m4_member(GraphWalker, nodesUpstream)
function nodesUpstream( starting ) {
  return this.collect( '_ins', 0, starting );
}

m4_member(GraphWalker, nodesUpstreamSameType)
function nodesUpstreamSameType( starting ) {
  return this.collect( '_ins', 1, starting );
}

m4_member(GraphWalker, nodesUpstreamOtherType)
function nodesUpstreamOtherType( starting ) {
  return this.collect( '_ins', -1, starting );
}

m4_member(GraphWalker, nodesDownstream)
function nodesDownstream( starting ) {
  return this.collect( '_outs', 0, starting );
}

m4_member(GraphWalker, nodesDownstreamSameType)
function nodesDownstreamSameType( starting ) {
  return this.collect( '_outs', 1, starting );
}

m4_member(GraphWalker, nodesDownstreamOtherType)
function nodesDownstreamOtherType( starting ) {
  return this.collect( '_outs', -1, starting );
}
