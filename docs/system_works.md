How you should use NANOTOPHEA
Think of one research study moving through the system like this:
NanoHepatoTea Study
1. Select the phytochemical
Start with the compound you want to investigate from Phyllanthus niruri, for example Quercetin.
Here you should be able to see its molecular information and physicochemical/drug-likeness information gathered from sources such as PubChem and SwissADME. The paper specifically describes compiling phytochemicals, cancer-related proteins, and liver-cancer cell lines from biomedical sources.     LSI_Development-of-Phyllanthus-…
↓
2. Select the target protein
Next, choose what protein the compound will be investigated against.
For example:
Quercetin → YAP1
or an oxidative-stress-related target such as:
Quercetin → Nrf2 / Keap1 / SOD / CAT / GPx
The paper specifically investigates target identification, protein–ligand interactions, binding affinity, and predicted mechanisms.     LSI_Development-of-Phyllanthus-…
↓
3. Select the cell line
For anticancer predictions, select the liver-cancer cell line.
For this research, the important example is:
HepG2 — human liver cancer cells
So your research setup becomes roughly:
Compound: Quercetin
Target: YAP1
Cell Line: HepG2

↓
4. Check ADMET / compound properties
Before interpreting biological predictions, inspect the compound's:
Physicochemical properties → Drug-likeness → ADME properties
The paper states that SwissADME was used for this part.     LSI_Development-of-Phyllanthus-…
So this page is basically answering:
"Is this compound computationally suitable enough to continue investigating?"

It is screening information, not experimental proof.
↓
5. Run Molecular Docking
Now you investigate:
Can Quercetin interact with YAP1?

The system uses AutoDock Vina for the docking calculations described in the paper.     LSI_Development-of-Phyllanthus-…
You would select:
Ligand: Quercetin
Receptor: YAP1
Then run the docking analysis.
The result should show things such as:
Binding affinity → Binding pose → Hydrogen bonds → Amino-acid residue interactions
The same process can be repeated for other relevant target proteins.
↓
6. Run DPPH Prediction
Now move from molecular interaction to the predicted antioxidant activity.
The paper describes an in-silico DPPH prediction using concentrations from 3.13–100 µM, with 0 µM as the blank.     LSI_Development-of-Phyllanthus-…
The system should produce things such as:
Concentration → Predicted DPPH scavenging
and results such as IC50, maximum scavenging, TEAC, and relative potency.
This answers:
"What antioxidant activity is computationally predicted?"

↓
7. Run the anticancer predictions
This is where your other pages become useful. They aren't separate unrelated experiments; they're different computational analyses of the same research question.
You proceed through:
MTT → LDH → ROS → BAX → Hippo–YAP
For example, MTT predicts effects on HepG2 cell viability across approximately 50–500 µg/mL, including predicted IC50, cell viability, maximum inhibition, and selectivity index. LDH predicts cytotoxicity/membrane damage. ROS investigates predicted oxidative-stress responses, while BAX examines apoptosis-related responses.     LSI_Development-of-Phyllanthus-…
So conceptually you're doing:
NanoHepatoTea / Quercetin
↓
HepG2
↓
What happens to cell viability?
↓
Is membrane damage predicted?
↓
What happens to oxidative stress?
↓
Is apoptosis predicted?
↓
What happens to relevant signaling pathways?

↓
8. Finish the computational assessment
At this point you have your in-silico evidence:
ADMET + Docking + DPPH + MTT + LDH + ROS + BAX + Hippo–YAP
These results collectively provide the predicted antioxidant/anticancer profile.
But this is important:
You don't stop here.
The paper explicitly describes the research as:
Computational screening → Laboratory validation.     LSI_Development-of-Phyllanthus-…
↓
9. Conduct the actual laboratory experiment
The researcher then performs the real laboratory work outside the software.
The paper describes experimental assessment including DPPH, LDH/HepG2 assessment, and characterization such as HPLC, proximate/nutritive, chemical, sensory, microbial, and stability analyses.     LSI_Development-of-Phyllanthus-…
There is an inconsistency in the paper worth knowing: one methods section says no experimental LDH assay was conducted, while another section describes experimental LDH validation. So the software shouldn't silently treat experimental LDH as unquestionably required until the researchers clarify which version is final.     LSI_Development-of-Phyllanthus-…
↓
10. Enter the laboratory results into NANOTOPHEA
This is where your Laboratory Results section should come in.
For example:
Experimental DPPH
Experimental LDH
HPLC / Characterization
Other laboratory measurements

These should be clearly separated from the computational predictions.
↓
11. Compare Prediction vs. Experiment
Now the system becomes especially useful.
Instead of merely displaying numbers, it should compare:
Predicted DPPH vs Experimental DPPH

and, where the study actually has matching experimental measurements:
Predicted LDH vs Experimental LDH

The paper describes analysis of laboratory data and comparison across treatment groups after the computational phase.     LSI_Development-of-Phyllanthus-…
So the complete workflow is:
Create/Open Study → Select Phytochemical → Select Target Protein → Select Cell Line → ADMET Screening → Molecular Docking → DPPH Prediction → MTT Prediction → LDH Prediction → ROS → BAX → Hippo–YAP → Review In-Silico Results → Conduct Laboratory Experiments → Enter Experimental Results → Statistical/Prediction-vs-Experimental Analysis → Interpretation
That also explains why your current NANOTOPHEA feels confusing. Your sidebar exposes everything at once:
Formulation / Phytochemicals / Proteins / Cell Lines / References / ADMET / Docking / DPPH / MTT / LDH / ROS / BAX / Hippo-YAP / Experimental...
A new researcher sees 15+ pages but doesn't know what to do first.
For the redevelopment, I would make Study Home the guide. It should visually show:
① Research Setup → ② In-Silico Screening → ③ Molecular Docking → ④ Biological Predictions → ⑤ Laboratory Validation → ⑥ Analysis & Interpretation
Then each stage has a Continue button. That would make NANOTOPHEA feel like one scientific workflow rather than a collection of disconnected pages.