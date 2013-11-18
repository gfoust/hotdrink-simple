function getter( context, used, key ) {
  return function() {
    used[key]= true;
    return context[key];
  };
}

function execute( fn, context ) {
  var used= {};
  var proxy= {};

  for (var key in context) {
    Object.defineProperty( proxy, key,
                           {enumerable: true,
                            get: getter( context, used, key )} );
  }

  try {
    var result= fn.call( proxy );
    return {used: used, result: result};
  }
  catch (e) {
    return {used: used, error: error};
  }
}

self.addEventListener( 'message', function( event ) {

  var fnstr= event.data.fn;
  fnstr= fnstr.substring( fnstr.indexOf( '{' ) + 1,
                          fnstr.lastIndexOf( '}' ) );
  var fn= new Function( fnstr );

  self.postMessage( execute( fn, event.data.context ) );
} );
