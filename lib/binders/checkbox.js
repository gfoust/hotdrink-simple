m4_module
m4_import(utility.noop,
          utility.makeObservable)
m4_export(bindCheckbox as checkbox)

function Checkbox( el ) {
  this.el= el;

  if (el) {
    el.addEventListener( 'change', this.update.bind( this ) );
  }
}

makeObservable( Checkbox.prototype )

m4_member(Checkbox, update)
function update() {
  this.sendNext( this.el.checked );
}

m4_member(Checkbox, onNext)
function onNext( value ) {
  this.el.checked= value;
}

m4_member(Checkbox, onError) noop;

m4_member(Checkbox, onCompleted) noop;

function bindCheckbox( el, vv ) {
  var cb= new Checkbox( el );
  vv.addSubscriber( cb );
  cb.addSubscriber( vv );
}