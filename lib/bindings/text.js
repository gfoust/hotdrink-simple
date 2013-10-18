/*********************************************************************
 * A read-only binding--puts value in element as text.
 */
m4_module
m4_import(utility.noop)
m4_export(Text)

function Text( el ) {
  this.el= el;
}


m4_method(Text, onNext)
function onNext( value ) {
  if (value === undefined || value === null) {
    value= '';
  }
  else if (typeof value !== 'string') {
    value= JSON.stringify( value );
  }

  var el= this.el;
  while (el.lastChild) {
    el.removeChild( el.lastChild );
  }
  el.appendChild( document.createTextNode( value ) );
}


m4_method(Text, onError) noop;


m4_method(Text, onCompleted) noop;
