from flask import Flask, request, render_template
app = Flask('Busan_travel')

@app.route('/index')
def indexhtml():
    return render_template("index.html")

@app.route('/tourist attraction')
def tourist attractionhtml():
    return render_template("tourist attraction.html")

@app.route('/festivities')
def festivitieshtml():
    return render_template("festivities.html")

@app.route('/index')
def indexhtml():
    return render_template("index.html")

@app.route('/method', methods=['GET', 'POST'])
def method():
    if request.method == 'GET':
        # args_dict = request.args.to_dict()
        # print(args_dict)
        num = request.args["num"]
        name = request.args.get("name")
        return "GET으로 전달된 데이터({}, {})".format(num, name)
    else:
        num = request.form["num"]
        name = request.form["name"]
        return "POST로 전달된 데이터({}, {})".format(num, name)

if __name__ == '__main__':
    app.run(debug=True)
