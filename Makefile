include Makefile.config

MAIN := $(TITLE).js

OBJECTS   := $(addprefix $(OBJDIR)/, $(SOURCES))
SOURCES   := $(addprefix $(SRCDIR)/, $(SOURCES))
TREEDIRS  := $(filter-out $(OBJDIR)/, $(sort $(dir $(OBJECTS))))
TESTFILES := $(patsubst support/%.js, $(TESTDIR)/%.js, $(SUPPORT))

v := 0
V := $(v)

AT_0 := @
AT_1 :=
AT := $(AT_$(V))

log :=
LOG := $(log)
M4FLAGS := -P $(foreach TAG, $(LOG), -DLOG_$(TAG))

INITOBJ := printf "\n"

debug : M4FLAGS += -DDEBUG
debug : INITOBJ := printf "\n/* %s */\n"
debug : $(MAIN) tests

release : $(MAIN) tests

.PHONY : tests
tests : $(TESTFILES) $(TESTDIR)/$(MAIN)

$(TITLE) : $(MAIN)

$(MAIN) : $(OBJDIR)/$(NSDEFS) $(OBJECTS)
	$(AT)cat $^ > $@

$(TESTDIR)/$(MAIN) : $(MAIN)
	$(AT)cp $< $@

$(TESTFILES) : $(TESTDIR)/%.js : support/%.js
	$(AT)cp $< $@

$(OBJDIR) :
	$(AT)mkdir -p $@

$(TREEDIRS) : | $(OBJDIR)/$(NSDEFS)
	$(AT)mkdir -p $@
	$(AT)printf "hd.%s= new hd.ns.Namespace();\n" $(subst /,.,$(patsubst $(OBJDIR)/%,%,$@)) >>$(OBJDIR)/$(NSDEFS);

$(OBJDIR)/$(NSDEFS) : $(MACRODEFS) $(SRCDIR)/$(NSDEFS) | $(OBJDIR)
	$(AT)$(INITOBJ) $(patsubst $(OBJDIR)/%, %, $@) > $@
	$(AT)m4 $(M4FLAGS) $^ >> $@

$(OBJECTS) : $(OBJDIR)/% : $(MACRODEFS) $(SRCDIR)/% | $(TREEDIRS)
	$(AT)$(INITOBJ) $(patsubst $(OBJDIR)/%, %, $@) > $@
	$(AT)m4 $(M4FLAGS) $^ >> $@
	$(AT)printf "\n" >> $@

.PHONY: clean
clean:
	$(AT)rm -f $(MAIN)
	$(AT)rm -rf $(OBJDIR)
	$(AT)rm -f $(TESTFILES) $(TESTDIR)/$(MAIN)
