/*********************************************************************
 * Various bindings to a text edit box.
 */
m4_module
m4_import(utility.noop,
          utility.makeObservable,
          utility.sendNext,
          utility.sendError,
          utility.Stabilizer)
m4_export(bindTextEdit as edit,
          bindNumberEdit as number,
          bindDateEdit as date)

/*====================================================================
 * Base text edit--the value is just text.
 */

function TextEdit( el ) {
  this.el= el;

  if (el) {
    el.addEventListener( 'input', this.update.bind( this ) );
    el.addEventListener( 'change', this.update.bind( this ) );
  }
}

makeObservable( TextEdit.prototype );


m4_member(TextEdit, update)
function update() {
  LOG(EDIT, this.el.id + " sending " + JSON.stringify( this.el.value ));
  sendNext( this, this.el.value );
}


m4_member(TextEdit, onNext)
function onNext( value ) {
  LOG(EDIT, this.el.id + " receiving " + JSON.stringify( value ));
  if (value === undefined || value === null) {
    value= '';
  }
  else if (typeof value !== 'string') {
    value = JSON.stringify(value);
  }
  if (this.el.value !== value) {
    this.el.value= value;
  }
}


m4_member(TextEdit, onError) noop;


m4_member(TextEdit, onCompleted) noop;


function bindTextEdit( el, vv ) {
  var ed= new TextEdit( el );
  vv.subscribe( ed );
  ed.subscribe( new Stabilizer( vv ) );
}

/*====================================================================
 * Translates its value to a number
 */

function NumberEdit( el ) {
  TextEdit.call( this, el );
}

NumberEdit.prototype= new TextEdit();


m4_member(NumberEdit, update)
function update() {
  LOG(EDIT, this.el.id + " sending " + JSON.stringify( this.el.value ));
  var n;
  if (this.el.value == '' ||
      isNaN( n= Number( this.el.value ) )) {
    sendError( this, "Invalid number" );
  }
  else {
    sendNext( this, n );
  }
}


function bindNumberEdit( el, vv ) {
  var ed= new NumberEdit( el );
  vv.subscribe( ed );
  ed.subscribe( new Stabilizer( vv ) );
}

/*====================================================================
 * Translates its value to a date
 */

function DateEdit( el ) {
  TextEdit.call( this, el );
}

DateEdit.prototype= new TextEdit();

m4_member(DateEdit, update)
function update() {
  LOG(EDIT, this.el.id + " sending " + JSON.stringify( this.el.value ));
  var d;
  if (this.el.value == '' ||
      isNaN( (d= Date( this.el.value )).getTime() )) {
    sendError( this, "Invalid date" );
  }
  else {
    sendNext( this, d );
  }
}


function bindDateEdit( el, vv ) {
  var ed= new DateEdit( el );
  vv.subscribe( ed );
  ed.subscribe( new Stabilizer( vv ) );
}
