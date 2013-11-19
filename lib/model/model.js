/*********************************************************************
 * Models
 */
m4_module
m4_export(Model,
          DATA)

/*====================================================================
 * The idea for a model is that its properties are variables,
 * constraints, and nested models.  But there is some additional data
 * that we need to keep track of just for housekeeping, so we stick
 * all that data in its own object and store it in an obscure property
 * of the model.
 */

var DATA= '_hd_data_'

function ModelData() {
  this.variables= [];
  this.constraints= [];
  this.models= [];
}


/*====================================================================
 * A model is a factory for building variables, constraints, and
 * methods.  Conceptually, however, a model may be thought of as a
 * subgraph of the entire constraint graph.
 *
 * The goal is that a model would serve as the component building
 * block for composing large models in a modular fashion.  Note,
 * however, that when solving and evaluating the constraint graph
 * models are ignored and we treat all variables and constraints as
 * belonging to one big graph.
 */

function Model() {
}

/*--------------------------------------------------------------------
 * Rather than require every model class to initialize data in the
 * constructor we give it a getter that creates it the first time it
 * is accessed.
 */
Object.defineProperty( Model.prototype, DATA, {
  get: function makeData() {
    var data= new ModelData;
    Object.defineProperty( this, DATA, {value: data} );
    return data;
  }
} );
