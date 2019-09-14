from django.shortcuts import redirect


def redirect_to_viewer(request):
    return redirect('graph/viewer')
