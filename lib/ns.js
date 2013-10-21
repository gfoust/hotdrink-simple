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

  var nsNamespace= new Namespace();
  nsNamespace.Namespace= Namespace;
  nsNamespace.extendNamespace= extendNamespace;

  var privateNamespace= new Namespace();
  privateNamespace.ns= nsNamespace;

  var publicNamespace= new Namespace();
  publicNamespace._= privateNamespace;

  publicNamespace.binders= new Namespace();

  return publicNamespace;

})();
