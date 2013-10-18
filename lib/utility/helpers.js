m4_module
m4_export(noop,
          setDiff,
          setInsert)

function noop() { }

function setDiff( as, bs ) {
  return as.filter( function ( a ) {
    bs.indexOf( a ) == -1;
  } );
}

function setInsert( as, a ) {
  if (as.indexOf( a ) == -1) {
    as.push( a );
  }
}

if (!window.console) {
  window.console= {log: noop,
                   warning: noop,
                   error: noop,
                   dir: noop
                  };
}
