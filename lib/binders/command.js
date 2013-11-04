m4_module
m4_import(utility.noop,
          utility.makeObservable)
m4_export(Command as command)

function Command( el ) {
  this.el= el;

  if (el) {
    el.addEventListener( 'click', this.invoke.bind( this ) );
  }
}

m4_member(Command, invoke)
function invoke() {
  if (this.command) {
    this.command.invoke();
  }
}

m4_member(Command, bind)
function bind( oo ) {
  oo.subscribe( this );
}

m4_member(Command, onNext)
function onNext( value ) {
  this.command= value;
}

m4_member(Command, onError) noop;

m4_member(Command, onCompleted) noop;