m4_module
m4_export( bind )

function compile( bindingString ) {
  return "return {" + bindingString + "}";  // nothing fancy for now
}

function callAllBinders( el, binders ) {
  for (binderName in binders) {
    if (binderName in hd.binders) {
      hd.binders[binderName]( el, binders[binderName] );
    }
    else {
      ERROR("No such binder: " + binderName);
    }
  }
}

function bindElement( el, model ) {
  var bindingString= el.getAttribute( 'data-bind' );
  if (!bindingString) {
    return;
  }

  var functionBody= compile( bindingString );
  if (!functionBody) {
    return;
  }
  if (model) {
    functionBody= "with (arguments[0]) { " + functionBody + " }";
  }

  try {
    var evalBinders= new Function( functionBody );
    var binders= evalBinders( model );
  }
  catch (e) {
    ERROR("Invalid binding declaration: " + JSON.stringify( bindingstring ));
    return;
  }

  callAllBinders( el, binders );

  return true;
}

function bindRec( dom, model ) {
  if (bindElement( dom, model )) {
    return;
  }

  var numChildren= dom.childNodes.length;
  for (var i= 0; i < numChildren; ++i) {
    if (dom.childNodes[i].nodeType === Node.ELEMENT_NODE) {
      bindRec( dom.childNodes[i], model );
    }
  }
}

function bind( dom, model ) {
  if (! dom) {
    dom= document.body;
  }

  if (dom.nodeType !== Node.ELEMENT_NODE) {
    ERROR("Invalid argument to bind");
  }

  bindRec( dom, model );
}