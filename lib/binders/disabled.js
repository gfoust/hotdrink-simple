m4_module
m4_import(utility.noop)
m4_export(bindDisabled as disabled)

function Disabled( el ) {
  this.el= el;
}

m4_member(Disabled, onNext)
function onNext( value ) {
  if (value) {
    this.el.disabled= true;
  }
  else {
    this.el.disabled= false;
  }
}

m4_member(Disabled, onError) noop;

m4_member(Disabled, onCompleted) noop;

function bindDisabled( el, val ) {
  var en= new Disabled( el );
  val.addSubscriber( en );
}
