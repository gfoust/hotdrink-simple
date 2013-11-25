m4_module
m4_export(noop,
          setDiff,
          setInsert,
          isType,
          isNotType,
          shallowCopy)

function noop() { }

function setDiff( as, bs ) {
  return as.filter( function ( a ) {
    return bs.indexOf( a ) == -1;
  } );
}

function setInsert( as, a ) {
  if (as.indexOf( a ) == -1) {
    as.push( a );
  }
}

function isType( obj ) {
  return obj instanceof this;
}

function isNotType( obj ) {
  return !(obj instanceof this);
}

function shallowCopy( obj ) {
  var copy= {};
  for (var key in obj) {
    copy[key]= obj[key];
  }
  return copy;
}

if (!window.console) {
  window.console= {log: noop,
                   warning: noop,
                   error: noop,
                   dir: noop
                  };
}
