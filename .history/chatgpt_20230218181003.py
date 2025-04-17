# import the OpenSTAAD module
from comtypes import client
import OpenSTAAD
os = client.GetActiveObject("StaadPro.OpenSTAAD")
# create a new instance of the STAAD class
staad = OpenSTAAD.STAAD()

# define the nodes of the structure
node1 = (0, 0, 0)
node2 = (0, 0, 5)
node3 = (5, 0, 5)
node4 = (5, 0, 0)

# add the nodes to the STAAD model
staad.Node(1, *node1)
staad.Node(2, *node2)
staad.Node(3, *node3)
staad.Node(4, *node4)

# define the members of the structure
staad.Member(1, 1, 2)
staad.Member(2, 2, 3)
staad.Member(3, 3, 4)
staad.Member(4, 4, 1)

# define the properties of the members
staad.Property(1, "RECT", 0.1, 0.1, "MATERIAL", "CONCRETE")
staad.Property(2, "RECT", 0.1, 0.1, "MATERIAL", "CONCRETE")
staad.Property(3, "RECT", 0.1, 0.1, "MATERIAL", "CONCRETE")
staad.Property(4, "RECT", 0.1, 0.1, "MATERIAL", "CONCRETE")

# apply the properties to the members
staad.Property("ALL")

# define the support conditions
staad.Support(1, "PINNED")
staad.Support(2, "FIXED")
staad.Support(3, "FIXED")
staad.Support(4, "FIXED")

# define the loads on the structure
staad.PointLoad(1, "FX", 100)

# perform the analysis
staad.Analyze()

# get the axial forces of each member
member_forces = []
for i in range(1, 5):
    axial_force = staad.MemberForce(i, "AXIAL")
    member_forces.append(axial_force)

# print the axial forces of each member
print(member_forces)