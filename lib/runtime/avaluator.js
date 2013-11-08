m4_module
m4_import(utility.Task,
          model.Variable,
          model.StayConstraint)
m4_export(runAsync,
          runSync,
          Evaluator)

var RUN_METHOD= 'runAsync';

function runAsync() {
  RUN_METHOD= 'runAsync';
}

function runSync() {
  RUN_METHOD= 'runSync';
}

function Evaluator() {
  this.generation= 0;
}

m4_member(Evaluator, evaluate)
function evaluate( changedVars, changedCons ) {
  ++this.generation;
  changedVars.forEach( this.markPendingDownstreamOfVariable, this );
  changedCons.forEach( this.markPendingDownstreamOfConstraint, this );
  changedVars.forEach( this.updateVariable, this );
  changedCons.forEach( this.updateConstraint, this );
}

m4_member(Evaluator, markPendingDownstreamOfVariable)
function markPendingDownstreamOfVariable( vv ) {
  if (vv.genpending == this.generation) return;
  vv.genpending= this.generation;
  vv.pending.set( true );
  vv.outputs.forEach( this.markPendingDownstreamOfConstraint, this )
}

m4_member(Evaluator, markPendingDownstreamOfConstraint)
function markPendingDownstreamOfConstraint( cc ) {
  if (cc.genpending == this.generation) return;
  cc.genpending= this.generation;
  cc.outputs.forEach( this.markPendingDownstreamOfVariable, this );
}

m4_member(Evaluator, updateVariable)
function updateVariable( vv ) {
  if (vv.genupdated == this.generation) return;
  vv.genupdated= this.generation;
  vv.pending.set( false );
  vv.outputs.forEach( this.updateConstraint, this );
}

m4_member(Evaluator, updateConstraint)
function updateConstraint( cc ) {
  if (cc.genupdated == this.generation) return;
  if (cc instanceof StayConstraint || cc.selectedMethod === null) {
    return;
  }

  var allReady= cc.inputs.every( function( vv ) {
    return vv.genpending <= vv.genupdated;
  } );

  if (allReady) {
    cc.genupdated= this.generation;
    var evaluator= this;
    var mm= cc.selectedMethod;
    var context= makeContext( mm );
    var genpending= cc.genpending;
    var task= new Task( mm.fn, context );
    task[RUN_METHOD]( function( data ) {
      if (cc.genpending === genpending) {
        if (mm.outputs.length == 1) {
          mm.outputs[0].internalSet( data.result );
          evaluator.updateVariable( mm.outputs[0] );
        }
        else {
          var length= mm.outputs.length;
          for (var i= 0; i < length; ++i) {
            mm.outputs[i].internalSet( data.result[i] );
            updateVariable( mm.outputs[i] );
          }
        }
      }
    } );
  }
}

function makeContext( mm ) {
  var context= {};
  for (var key in mm.context) {
    var val= mm.context[key];
    context[key]= (val instanceof Variable) ? val.get() : val;
  }
  for (var key in mm.model) {
    var val= mm.model[key];
    if (! (key in context)) {
      context[key]= (val instanceof Variable) ? val.get() : val;
    }
  }
  return context;
}