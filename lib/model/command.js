m4_module

m4_export(makeCommand)

function Command( fn, context ) {
  this.fn= fn;
  this.context= context;
}

m4_member(Command, invoke)
function invoke() {
  this.fn.call( this.context );
}

function makeCommand( fn, context ) {
  return new Command( fn, context );
}