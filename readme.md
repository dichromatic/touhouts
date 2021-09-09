everything is a collidable and everything collidable is a circle
aliens need a velocity since they change velocity depending on how many aliens are left on grid (seems like exponential change)
aliens only have an x velocity, and ship only has a constant x velocity
aliens bullet velocity is different to the ships bullet velocity
aliens y position moves closer everytime they hit the edge of the wall
aliens are a 5x10 grid fit in a 600x600 canvas
shields and bullets are just circles for simplicity, except shields dont move
maybe make shields a bunch of concentrated circles that disappear per collision
array of aliens can be a 2d array of alien objects

basic cycle of running: 
key press -> define templates for entities and state -> create initial entities and state
-> reducestate is defined to change the state and entities per interval -> interval calls 
reducestate to merge all states and entities -> interval subscribes to a html updater to 
actually show  state and entity changes -> interval repeats every x milliseconds for y amount
of setTimeout(game, y)

seperate function to graphically show keypresses on the html -> setTimeout(keypresses, x)
where x is amount repeated

vectors from the unit notes and the asteroids example will be reused

if bullets dont expire or expire on screen exit then it will keep torusing around the screen (will probably fuck shit up)

all entities will only wrap in the x axis. bullets will stop existing once it hits the y canvas limits (0 or 600) and players and aliens cant cross that boundary. 

shields will circle around the player as balls. Will have differing hp by overlapping different circles 

add ways for custom intervals, different levels, different bullet movement, different alien movement for the full touhou game -> bullets will have angle in later revisions. 

list of things to account for in write up:
how bullet movements work
how alien movements work
how player and shield movement works
how collisions are handled
how things are garbaged
how wrapping works and why
what things are taken from asteroids

movement values as defaults: 
alien movement vector is based on the elapsed time working as an angle, with a constant downward vector
alien bullets is their respecitve aliens movement vector at the time of creation

// [...Array(3)].map((_,i) => createShield(String(i+3))((i+1)*3)(new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.8).add(Vec.unitVecInDirection(300).scale(35).add(Vec.unitVecInDirection(90).scale(-5))))(Vec.Zero)(0)),
// [...Array(3)].map((_,i) => createShield(String(i+6))((i+1)*3)(new Vec(Constants.CanvasSize/2, Constants.CanvasSize*0.8).add(Vec.unitVecInDirection(0).scale(-35).add(Vec.unitVecInDirection(90).scale(-5))))(Vec.Zero)(0))
),//.map(x => x.pos.add(Vec.unitVecInDirection(90).scale(-10))),

for every sub interval add velocity, for every not sub interval minus that velocity