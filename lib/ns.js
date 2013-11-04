/*********************************************************************
 * This defines the Namespace class as well as the root namespaces
 * which are used by the rest of the project.
 */
var hd= (function () {

  function Namespace() {
  }

  function extendNamespace( ns, obj ) {
    if (obj) {
      for (var name in obj) {
        ns[name]= obj[name];
      }
    }

    return this;
  }

  var publicNamespace= new Namespace();
  publicNamespace.ns= new Namespace();
  publicNamespace.ns.Namespace= Namespace;
  publicNamespace.ns.extendNamespace= extendNamespace;

  return publicNamespace;

})();
