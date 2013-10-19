include Makefile.config

MAIN := $(TITLE).js

OBJECTS  := $(addprefix $(OBJDIR)/, $(SOURCES))
SOURCES  := $(addprefix $(SRCDIR)/, $(SOURCES))
TREEDIRS := $(filter-out $(OBJDIR)/, $(sort $(dir $(OBJECTS))))

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
debug : $(MAIN)

all : $(MAIN)

release : $(MAIN)

$(TITLE) : $(MAIN)

$(MAIN) : $(OBJDIR)/$(NSDEFS) $(OBJECTS)
	$(AT)cat $^ > $@

# $(OBJDIR)/$(NSDEFS) : | $(TREEDIRS)
# 	printf "" >$(OBJDIR)/$(NSDEFS)
# 	for d in $(subst /,.,$(patsubst %/,%,$(TREEDIRS))); do \
# 		printf "hd.%s= hd.namespace();\n" $$d >>$(OBJDIR)/$(NSDEFS); \
# 	done

$(OBJDIR) :
	$(AT)mkdir -p $@

$(TREEDIRS) : | $(OBJDIR)/$(NSDEFS)
	$(AT)mkdir -p $@
	$(AT)printf "hd._.%s= new hd._.ns.Namespace();\n" $(subst /,.,$(patsubst $(OBJDIR)/%,%,$@)) >>$(OBJDIR)/$(NSDEFS);

$(OBJDIR)/$(NSDEFS) : $(MACRODEFS) $(SRCDIR)/$(NSDEFS) | $(OBJDIR)
	$(AT)$(INITOBJ) $(patsubst $(OBJDIR)/%, %, $@) > $@
	$(AT)m4 $(M4FLAGS) $^ >> $@

$(OBJECTS) : $(OBJDIR)/% : $(MACRODEFS) $(SRCDIR)/% | $(TREEDIRS)
	$(AT)$(INITOBJ) $(patsubst $(OBJDIR)/%, %, $@) > $@
	$(AT)m4 $(M4FLAGS) $^ >> $@
	$(AT)printf "\n" >> $@

clean:
	$(AT)rm -f $(MAIN)
	$(AT)rm -rf $(OBJDIR)