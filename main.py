import pygame, sys, os, numpy as np, asyncio

FPS = 60
DISPLAYWIDTH = 600
DISPLAYHEIGHT = 400

XMARGIN = 30
YMARGIN = 30

PLAYERSPEED = 3 # Tiles per Second

# Gets the directory of the file to load resources using relative path
CWD = os.path.dirname(__file__)

async def main():
    global DISPLAYSURF, FPSCLOCK, DEFAULTFONT

    pygame.init()
    DISPLAYSURF = pygame.display.set_mode( (DISPLAYWIDTH, DISPLAYHEIGHT) ) # Create a screen
    FPSCLOCK = pygame.time.Clock()

    pygame.display.set_caption("Life & Death") # Give the window a caption

    DEFAULTFONT = pygame.font.Font("freesansbold.ttf", 50)

    screen = "titlescreen"

    while True:
        DISPLAYSURF.fill("black")
        # Set the screen
        if screen == "titlescreen":
            screen = await titleScreen()
        elif screen == "levelselection":
            screen = await levelSelection()
        elif screen == "gamewon":
            screen = await gameWon()
        elif screen.find("gameover") >= 0:
            screen = await gameOver(screen)
        elif screen.find("level") >= 0:
            screen = await loadLevel(screen)
        # Event handeler
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                terminate()
            # elif event.type == pygame.KEYUP:
            #     if event.key == pygame.K_ESCAPE:
            #         terminate()

        # Update screen at FPS
        pygame.display.update()
        FPSCLOCK.tick(FPS)
        await asyncio.sleep(0)

async def titleScreen(): # Main menu screen
    titleFont = pygame.font.Font("freesansbold.ttf", 70)
    buttonFont = pygame.font.Font("freesansbold.ttf", 25)
    while True:
        DISPLAYSURF.fill("black")
        titleSurf = titleFont.render("Life & Death", True, "white", None)
        titleRect = titleSurf.get_rect()
        titleRect.center = (DISPLAYWIDTH / 2, DISPLAYHEIGHT / 2 - 50)
        DISPLAYSURF.blit(titleSurf, titleRect)
        buttonBox = pygame.draw.rect(DISPLAYSURF, "white", (DISPLAYWIDTH/2 -50, DISPLAYHEIGHT/2 + 30, 100, 30), 0, 5)
        buttonSurf = buttonFont.render("Play", True, "black", None)
        buttonRect = buttonSurf.get_rect()
        buttonRect.centerx = DISPLAYWIDTH/2
        buttonRect.centery = DISPLAYHEIGHT/2 + 45
        DISPLAYSURF.blit(buttonSurf, buttonRect)
        # Event Handler
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                terminate()
            elif event.type == pygame.KEYUP:
                if event.key == pygame.K_ESCAPE:
                    terminate()
            elif event.type == pygame.MOUSEBUTTONUP:
                mousex, mousey = event.pos
                if buttonBox.collidepoint(mousex, mousey):
                    return "levelselection"
        # Update Screen at FPS
        pygame.display.update()
        FPSCLOCK.tick(FPS)
        await asyncio.sleep(0)

async def levelSelection(): # Level selection screen
    DISPLAYSURF.fill("white")

    levelFont = pygame.font.Font("freesansbold.ttf", 50)

    # Create boxes for each level
    levels = []
    l = 1
    for y in range(3):
        for x in range(5):
            levelSurf = levelFont.render(str(l), True, "lightgray", None)
            levelRect = levelSurf.get_rect()
            levelRect.center = (10*x + 100*x + 80, 10*y + 100*y + 110)
            levels.append((pygame.rect.Rect(10*x + 100*x + 30, 10*y + 100*y + 60, 100, 100),levelSurf,levelRect,l))
            l+=1

    backButtonSurf = pygame.image.load(os.path.join(CWD, "./resources/textures/backButton.png"))
    backButtonSurf = pygame.transform.scale(backButtonSurf, (50, 50))
    backButtonRect = backButtonSurf.get_rect()
    backButtonRect.topleft = (XMARGIN, 5)

    while True:
        DISPLAYSURF.fill("black")      
        # Draw box for each level
        for level in levels:
            levelBox, levelSurf, levelRect, _ = level
            pygame.draw.rect(DISPLAYSURF, (114, 68, 30), levelBox, 0, 5)
            DISPLAYSURF.blit(levelSurf, levelRect)

        DISPLAYSURF.blit(backButtonSurf, backButtonRect)

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                terminate()
            elif event.type == pygame.KEYUP:
                if event.key == pygame.K_ESCAPE:
                    return "titlescreen"
            elif event.type == pygame.MOUSEBUTTONUP:
                if backButtonRect.collidepoint(event.pos): # If back button is clicked go back to the title screen
                    return "titlescreen"
                for level in levels: # If the mouse is clicked check if player selected a level
                    box, _, _, l= level
                    if box.collidepoint(event.pos):
                        return "level" + str(l) # If a level was selected load that level

        pygame.display.update()
        FPSCLOCK.tick(FPS)
        await asyncio.sleep(0)

async def loadLevel(levelName:str):
    levelNum = int(levelName.replace("level", ""))
    levelPath = os.path.join(CWD, "./resources/levels/"+levelName+".txt") # Open level file
    paths = []
    walls = []
    traps = []
    try:
        with open(levelPath, 'r') as contents: # Read Contents
            level = contents.read().split()
            for y in range(len(level)):
                row = []
                for x in range(len(level[y])):
                    row.append(level[y][x])
                    if level[y][x] == '#':
                        walls.append((x,y))
                    elif level[y][x] == 'X':
                        paths.append((x,y))
                    elif level[y][x] == 'S':
                        spawnCoords = (x,y)
                        paths.append((x,y))
                    elif level[y][x] == 'E':
                        endCoords = (x,y)
                        paths.append((x,y))
                    elif level[y][x] == 'D':
                        paths.append((x,y))
                        traps.append((x,y))
    except:
        return "levelselection"
    # Calculate width of each tile and the position of the level on the screen
    mapWidth, mapHeight = len(level[0]), len(level)
    width = (DISPLAYWIDTH-XMARGIN*2) / mapWidth
    xoff = XMARGIN
    height = (DISPLAYHEIGHT-YMARGIN*2) / mapHeight
    yoff = YMARGIN
    if width > height:
        width = height
        xoff = (DISPLAYWIDTH-XMARGIN*2 - mapWidth*width) / 2 + XMARGIN
    elif height > width:
        height = width
        yoff = (DISPLAYHEIGHT-YMARGIN*2 - mapHeight*height) / 2 + YMARGIN

    # Create player
    playerPosition = np.array([spawnCoords[0]*width + xoff, spawnCoords[1]*height + yoff])
    playerCoords = np.array(spawnCoords)
    playerIdle = pygame.transform.scale(pygame.image.load(os.path.join(CWD, "./resources/textures/idle_front.png")), (width, height))
    playerRight = pygame.transform.scale(pygame.image.load(os.path.join(CWD, "./resources/textures/running_right.png")), (width, height))
    playerLeft = pygame.transform.flip(playerRight, True, False)
    playerBack = pygame.transform.scale(pygame.image.load(os.path.join(CWD, "./resources/textures/idle_back.png")), (width, height))
    playerDirection = None
    playerImage = playerIdle
    newPlayerCoords = [-1, -1]
    playerNextDirection = None

    deathPosition = np.array([spawnCoords[0]*width + xoff, spawnCoords[1]*height + yoff])
    deathCoords = np.array(spawnCoords)
    death_waiting = pygame.transform.scale(pygame.image.load(os.path.join(CWD, "./resources/textures/death_waiting.png")), (width, height))
    chasing_right = pygame.transform.scale(pygame.image.load(os.path.join(CWD, "./resources/textures/chasing_right.png")), (width, height))
    chasing_left = pygame.transform.flip(chasing_right, True, False)
    deathDirection = None
    deathImage = death_waiting
    newDeathCoords = [-1, -1]

    firstMove = True
    deathMoves = []

    totalPlayerFrames = 3
    playerFrame = totalPlayerFrames
    spawnProtection = FPS / totalPlayerFrames

    totalDeathFrames = 60
    deathFrame = totalDeathFrames

    while True:

        if playerDirection == None:
            if not playerNextDirection == None:
                playerDirection = playerNextDirection
                playerNextDirection = None
                for i in range(len(deathMoves)):
                    if (deathMoves[i][0][0] == playerCoords[0]) and (deathMoves[i][0][1] == playerCoords[1]):
                        deathMoves = deathMoves[0:i]
                        break
                deathMoves.append((playerCoords, playerDirection))
        
        if playerFrame == totalPlayerFrames:
            if not playerDirection == None:
                newPlayerCoords = [-1,-1]
                if (not playerNextDirection == None) and (not abs(playerNextDirection - playerDirection) == 180): # Prevents player from switching back
                    # Allows player to go through doorways
                    if playerNextDirection == 0:
                        newPlayerCoords = playerCoords + np.array([1,0])
                    elif playerNextDirection == 90:
                        newPlayerCoords = playerCoords + np.array([0,-1])
                    elif playerNextDirection == 180:
                        newPlayerCoords = playerCoords + np.array([-1,0])
                    elif playerNextDirection == 270:
                        newPlayerCoords = playerCoords + np.array([0,1])

                if (newPlayerCoords[0], newPlayerCoords[1]) in paths:
                    playerDirection = playerNextDirection
                    playerNextDirection = None
                    deathMoves.append((playerCoords, playerDirection))
                else:
                    if playerDirection == 0:
                        newPlayerCoords = playerCoords + np.array([1,0])
                        playerImage = playerRight
                    elif playerDirection == 90:
                        newPlayerCoords = playerCoords + np.array([0,-1])
                        playerImage = playerBack
                    elif playerDirection == 180:
                        newPlayerCoords = playerCoords + np.array([-1,0])
                        playerImage = playerLeft
                    elif playerDirection == 270:
                        newPlayerCoords = playerCoords + np.array([0,1])
                        playerImage = playerIdle
                    if not (newPlayerCoords[0], newPlayerCoords[1]) in paths:
                        playerDirection = None
                        newPlayerCoords = np.array([-1,-1])
                        deathMoves.append((playerCoords, playerDirection))

            if not (newPlayerCoords[0] == -1 and newPlayerCoords[1] == -1):
                oldPlayerPosition = np.array([playerCoords[0]*width + xoff, playerCoords[1]*height + yoff])
                playerCoords = newPlayerCoords
                playerPosition = np.array([playerCoords[0]*width + xoff, playerCoords[1]*height + yoff])
                if not (oldPlayerPosition[0] == playerPosition[0] and oldPlayerPosition[1] == playerPosition[1]):
                    playerFrame = 0

        if spawnProtection <= 0:
                    firstMove = False
        if (playerCoords[0], playerCoords[1]) == endCoords:
            if (levelNum < 15):
                return "level" + str(levelNum + 1)
            else:
                return "gamewon"
        elif (playerCoords[0], playerCoords[1]) in traps:
            return "gameover" + str(levelName)
        elif np.array_equiv(playerCoords, deathCoords):
            if not firstMove:
                return "gameover" + str(levelName)

        if deathFrame == totalDeathFrames:
            if len(deathMoves) > 0:
                if (deathCoords[0], deathCoords[1]) == (deathMoves[0][0][0], deathMoves[0][0][1]):
                    deathDirection = deathMoves[0][1]
                    del(deathMoves[0])
            newDeathCoords = np.array([-1,-1])
            if deathDirection == 0:
                newDeathCoords = deathCoords + np.array([1,0])
                deathImage = chasing_right
            elif deathDirection == 90:
                newDeathCoords = deathCoords + np.array([0,-1])
                deathImage = death_waiting
            elif deathDirection == 180:
                newDeathCoords = deathCoords + np.array([-1,0])
                deathImage = chasing_left
            elif deathDirection == 270:
                newDeathCoords = deathCoords + np.array([0,1])
                deathImage = death_waiting
            if (newDeathCoords[0], newDeathCoords[1]) in paths:
                prevDeathPos = np.array([deathCoords[0]*width + xoff, deathCoords[1]*height + yoff])
                deathCoords = newDeathCoords
                deathPosition = np.array([deathCoords[0]*width + xoff, deathCoords[1]*height + yoff])
                if not (prevDeathPos[0] == deathPosition[0] and prevDeathPos[1] == deathPosition[1]):
                    deathFrame = 0

        deathPosition = np.array([deathCoords[0]*width + xoff, deathCoords[1]*height + yoff])

        drawLevel((width, height), (xoff, yoff), walls, paths, traps, spawnCoords, endCoords)
        if playerFrame < totalPlayerFrames:
            totalx = playerPosition[0] - oldPlayerPosition[0]
            totaly = playerPosition[1] - oldPlayerPosition[1]
            time = playerFrame/totalPlayerFrames
            pos = np.array([oldPlayerPosition[0] + totalx*time, oldPlayerPosition[1] + totaly*time])
            DISPLAYSURF.blit(playerImage, pos)
            playerFrame += 1
            spawnProtection -= 1
        else:
            DISPLAYSURF.blit(playerImage, playerPosition)
        if deathFrame < totalDeathFrames:
            totalx = deathPosition[0] - prevDeathPos[0]
            totaly = deathPosition[1] - prevDeathPos[1]
            time = deathFrame/totalDeathFrames
            pos = np.array([prevDeathPos[0] + totalx*time, prevDeathPos[1] + totaly*time])
            DISPLAYSURF.blit(deathImage, pos)
            deathFrame += 1
            spawnProtection -= 1
        else:
            DISPLAYSURF.blit(deathImage, deathPosition)

        # Event Handler
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                terminate()
            elif event.type == pygame.KEYUP:
                if event.key == pygame.K_ESCAPE:
                    return "levelselection"
            elif event.type == pygame.KEYDOWN:
                if event.key in (pygame.K_w, pygame.K_UP):
                    playerNextDirection = 90
                elif event.key in (pygame.K_a, pygame.K_LEFT):
                    playerNextDirection = 180
                elif event.key in (pygame.K_s, pygame.K_DOWN):
                    playerNextDirection = 270
                elif event.key in (pygame.K_d, pygame.K_RIGHT):
                    playerNextDirection = 0
                elif event.key == pygame.K_e:
                    print(deathMoves)

        pygame.display.update()
        FPSCLOCK.tick(FPS)
        await asyncio.sleep(0)

async def gameOver(level:str):
    titleFont = pygame.font.Font("freesansbold.ttf", 70)
    buttonFont = pygame.font.Font("freesansbold.ttf", 25)
    while True:
        DISPLAYSURF.fill("black")
        titleSurf = titleFont.render("GAME OVER", True, "white", None)
        titleRect = titleSurf.get_rect()
        titleRect.center = (DISPLAYWIDTH / 2, DISPLAYHEIGHT / 2 - 50)
        DISPLAYSURF.blit(titleSurf, titleRect)
        buttonBox = pygame.draw.rect(DISPLAYSURF, "white", (DISPLAYWIDTH/2 -75, DISPLAYHEIGHT/2 + 30, 150, 30), 0, 5)
        buttonSurf = buttonFont.render("Try Again", True, "black", None)
        buttonRect = buttonSurf.get_rect()
        buttonRect.centerx = DISPLAYWIDTH/2
        buttonRect.centery = DISPLAYHEIGHT/2 + 45
        DISPLAYSURF.blit(buttonSurf, buttonRect)
        # Event Handler
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                terminate()
            elif event.type == pygame.KEYUP:
                if event.key == pygame.K_ESCAPE:
                    return "levelselection"
                elif event.key == pygame.K_RETURN:
                    return level.replace("gameover", "")
            elif event.type == pygame.MOUSEBUTTONUP:
                mousex, mousey = event.pos
                if buttonBox.collidepoint(mousex, mousey):
                    return level.replace("gameover", "")
        # Update Screen at FPS
        pygame.display.update()
        FPSCLOCK.tick(FPS)
        await asyncio.sleep(0)

async def gameWon():
    titleFont = pygame.font.Font("freesansbold.ttf", 70)
    buttonFont = pygame.font.Font("freesansbold.ttf", 25)
    while True:
        DISPLAYSURF.fill("black")
        titleSurf = titleFont.render("YOU WON!", True, "white", None)
        titleRect = titleSurf.get_rect()
        titleRect.center = (DISPLAYWIDTH / 2, DISPLAYHEIGHT / 2 - 50)
        DISPLAYSURF.blit(titleSurf, titleRect)
        buttonBox = pygame.draw.rect(DISPLAYSURF, "white", (DISPLAYWIDTH/2 -75, DISPLAYHEIGHT/2 + 30, 150, 30), 0, 5)
        buttonSurf = buttonFont.render("Return", True, "black", None)
        buttonRect = buttonSurf.get_rect()
        buttonRect.centerx = DISPLAYWIDTH/2
        buttonRect.centery = DISPLAYHEIGHT/2 + 45
        DISPLAYSURF.blit(buttonSurf, buttonRect)
        # Event Handler
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                terminate()
            elif event.type == pygame.KEYUP:
                if event.key == pygame.K_ESCAPE:
                    return "levelselection"
                elif event.key == pygame.K_RETURN:
                    return "titlescreen"
            elif event.type == pygame.MOUSEBUTTONUP:
                mousex, mousey = event.pos
                if buttonBox.collidepoint(mousex, mousey):
                    return "titlescreen"
        # Update Screen at FPS
        pygame.display.update()
        FPSCLOCK.tick(FPS)
        await asyncio.sleep(0)

def drawLevel(size, offset, walls, paths, traps, spawnCoords, endCoords):
    width, height = size
    xoff, yoff = offset
    DISPLAYSURF.fill("black")
    for wall in walls:
        x, y = wall
        pygame.draw.rect(DISPLAYSURF, "darkgray", (x*width + xoff, y*height + yoff, width, height))
    for path in paths:
        x, y = path
        pygame.draw.rect(DISPLAYSURF, (114, 68, 30), (x*width + xoff, y*height + yoff, width, height))
    pygame.draw.circle(DISPLAYSURF, "lightgreen", (endCoords[0]*width+xoff+width/2, endCoords[1]*height+yoff+height/2), width/2)
    for trap in traps:
        pygame.draw.circle(DISPLAYSURF, "red", (trap[0]*width+xoff+width/2, trap[1]*height+yoff+height/2), width/2)

def terminate():
    pygame.quit()
    sys.exit()

asyncio.run(main())