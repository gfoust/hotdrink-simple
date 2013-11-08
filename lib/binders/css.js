m4_module
m4_import(utility.noop,
          model.Variable)
m4_export(bindCss as css)

function Css( el, className ) {
  this.el= el;
  this.className= className;
  this.classRegex= new RegExp( "\\b" + className + "\\b", "g" );
}

m4_member(Css, onNext)
function onNext( value ) {
  if (value) {
    if (!this.classRegex.test( this.el.className )) {
      this.el.className=
        this.el.className + " " + this.className;
    }
  }
  else {
    this.el.className=
      this.el.className.replace( this.classRegex, "" )
                       .replace( /[ \t\r\n\f]+/, " " )
                       .trim();
  }
}

m4_member(Css, onError) noop;

m4_member(Css, onCompleted) noop;

function bindCss( el, spec ) {
  if (spec instanceof Variable) {
    spec= {pending: spec.pending,
           error: spec.error,
           invalid: spec.invalid,
           source: spec.source};
  }
  for (var key in spec) {
    var cn= new Css( el, key );
    spec[key].subscribe( cn );
  }
}
