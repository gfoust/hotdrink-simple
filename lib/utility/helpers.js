m4_module
m4_export(noop,
          setDiff,
          setInsert,
          isType,
          isNotType)

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

if (!window.console) {
  window.console= {log: noop,
                   warning: noop,
                   error: noop,
                   dir: noop
                  };
}
