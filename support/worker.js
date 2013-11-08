function getter( context, used, key ) {
  return function() {
    used[key]= true;
    return context[key];
  };
}

self.addEventListener( 'message', function( event ) {

  var fnstr= event.data.fn;
  fnstr= fnstr.substring( fnstr.indexOf( '{' ) + 1,
                          fnstr.lastIndexOf( '}' ) );
  var fn= new Function( fnstr );

  var context= event.data.context;
  var used= {};
  var proxy= {};

  for (var key in context) {
    Object.defineProperty( proxy, key,
                           {enumerable: true,
                            get: getter( context, used, key )} );
  }

  var result= fn.call( proxy );

  self.postMessage( {used: used, result: result} );
} );
